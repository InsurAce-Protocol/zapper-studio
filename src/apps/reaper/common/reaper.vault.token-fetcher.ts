import { Inject } from '@nestjs/common';

import { APP_TOOLKIT, IAppToolkit } from '~app-toolkit/app-toolkit.interface';
import { isMulticallUnderlyingError } from '~multicall/multicall.ethers';
import { AppTokenTemplatePositionFetcher } from '~position/template/app-token.template.position-fetcher';
import {
  GetAddressesParams,
  GetDataPropsParams,
  DefaultAppTokenDataProps,
  GetUnderlyingTokensParams,
  GetPricePerShareParams,
  GetDisplayPropsParams,
} from '~position/template/app-token.template.types';

import { ReaperContractFactory, ReaperCrypt } from '../contracts';

import { ReaperVaultCacheManager } from './reaper.vault.cache-manager';

type ReaperVaultDefinition = {
  name: string;
  address: string;
  underlyingAddress: string;
  apy: number;
};

export abstract class ReaperVaultTokenFetcher extends AppTokenTemplatePositionFetcher<
  ReaperCrypt,
  DefaultAppTokenDataProps,
  ReaperVaultDefinition
> {
  constructor(
    @Inject(APP_TOOLKIT) protected readonly appToolkit: IAppToolkit,
    @Inject(ReaperContractFactory) protected readonly contractFactory: ReaperContractFactory,
    @Inject(ReaperVaultCacheManager) protected readonly cacheManager: ReaperVaultCacheManager,
  ) {
    super(appToolkit);
  }

  getContract(address: string): ReaperCrypt {
    return this.contractFactory.reaperCrypt({ address, network: this.network });
  }

  async getDefinitions() {
    return this.cacheManager.getCryptDefinitions(this.network);
  }

  async getAddresses({ definitions }: GetAddressesParams) {
    return definitions.map(v => v.address);
  }

  async getUnderlyingTokenAddresses({ definition }: GetUnderlyingTokensParams<ReaperCrypt, ReaperVaultDefinition>) {
    return [definition.underlyingAddress];
  }

  async getPricePerShare({
    appToken,
    contract,
  }: GetPricePerShareParams<ReaperCrypt, DefaultAppTokenDataProps, ReaperVaultDefinition>): Promise<number | number[]> {
    const pricePerShareRaw = await contract.getPricePerFullShare().catch(err => {
      if (isMulticallUnderlyingError(err)) return 0;
      throw err;
    });

    const pricePerShare = Number(pricePerShareRaw) / 10 ** appToken.decimals;
    return [pricePerShare];
  }

  async getLiquidity({ appToken }: GetDataPropsParams<ReaperCrypt>) {
    return appToken.supply * appToken.price;
  }

  async getReserves({ appToken }: GetDataPropsParams<ReaperCrypt>) {
    return [appToken.pricePerShare[0] * appToken.supply];
  }

  async getApy(_params: GetDataPropsParams<ReaperCrypt>) {
    return 0;
  }

  async getLabel({ contract }: GetDisplayPropsParams<ReaperCrypt>) {
    return contract.name();
  }
}
