import { Inject } from '@nestjs/common';

import { APP_TOOLKIT, IAppToolkit } from '~app-toolkit/app-toolkit.interface';
import { ZERO_ADDRESS } from '~app-toolkit/constants/address';
import { CompoundContractFactory } from '~apps/compound';
import { CompoundSupplyTokenFetcher, GetMarketsParams } from '~apps/compound/common/compound.supply.token-fetcher';
import {
  GetDataPropsParams,
  GetPricePerShareParams,
  GetUnderlyingTokensParams,
} from '~position/template/app-token.template.types';
import { Network } from '~types/network.interface';

import { B_PROTOCOL_DEFINITION } from '../b-protocol.definition';
import { BProtocolContractFactory, BProtocolCompoundComptroller, BProtocolCompoundToken } from '../contracts';

export class EthereumBProtocolCompoundSupplyTokenFetcher extends CompoundSupplyTokenFetcher<
  BProtocolCompoundToken,
  BProtocolCompoundComptroller
> {
  appId = B_PROTOCOL_DEFINITION.id;
  groupId = B_PROTOCOL_DEFINITION.groups.compoundSupply.id;
  network = Network.ETHEREUM_MAINNET;
  groupLabel = 'Compound Lending';
  comptrollerAddress = '0x9db10b9429989cc13408d7368644d4a1cb704ea3';

  constructor(
    @Inject(APP_TOOLKIT) protected readonly appToolkit: IAppToolkit,
    @Inject(BProtocolContractFactory) protected readonly contractFactory: BProtocolContractFactory,
    @Inject(CompoundContractFactory) protected readonly compoundContractFactory: CompoundContractFactory,
  ) {
    super(appToolkit);
  }

  getCompoundCTokenContract(address: string) {
    return this.contractFactory.bProtocolCompoundToken({ address, network: this.network });
  }

  getCompoundComptrollerContract(address: string) {
    return this.contractFactory.bProtocolCompoundComptroller({ address, network: this.network });
  }

  async getMarkets({ contract }: GetMarketsParams<BProtocolCompoundComptroller>) {
    const cTokenAddresses = await contract.getAllMarkets();
    const bTokenAddresses = await Promise.all(cTokenAddresses.map(cTokenAddress => contract.c2b(cTokenAddress)));
    return bTokenAddresses.filter(v => v !== ZERO_ADDRESS);
  }

  async getUnderlyingAddress({ contract }: GetUnderlyingTokensParams<BProtocolCompoundToken>) {
    return contract.underlying();
  }

  async getExchangeRate({ contract }: GetPricePerShareParams<BProtocolCompoundToken>) {
    return contract.callStatic.exchangeRateCurrent();
  }

  async getSupplyRate({ contract, multicall }: GetDataPropsParams<BProtocolCompoundToken>) {
    const cTokenAddress = await contract.cToken();
    const cToken = this.compoundContractFactory.compoundCToken({ address: cTokenAddress, network: this.network });
    return multicall
      .wrap(cToken)
      .supplyRatePerBlock()
      .catch(() => 0);
  }
}
