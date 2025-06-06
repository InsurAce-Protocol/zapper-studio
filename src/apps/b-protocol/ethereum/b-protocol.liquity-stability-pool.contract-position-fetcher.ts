import { Inject } from '@nestjs/common';

import { APP_TOOLKIT, IAppToolkit } from '~app-toolkit/app-toolkit.interface';
import { ZERO_ADDRESS } from '~app-toolkit/constants/address';
import { getLabelFromToken } from '~app-toolkit/helpers/presentation/image.present';
import { MetaType } from '~position/position.interface';
import { ContractPositionTemplatePositionFetcher } from '~position/template/contract-position.template.position-fetcher';
import {
  DefaultContractPositionDefinition,
  GetDisplayPropsParams,
  GetTokenBalancesParams,
} from '~position/template/contract-position.template.types';
import { Network } from '~types/network.interface';

import { B_PROTOCOL_DEFINITION } from '../b-protocol.definition';
import { BProtocolContractFactory, BProtocolBamm } from '../contracts';

export class EthereumLiquityStabilityPoolContractPositionFetcher extends ContractPositionTemplatePositionFetcher<BProtocolBamm> {
  appId = B_PROTOCOL_DEFINITION.id;
  groupId = B_PROTOCOL_DEFINITION.groups.liquityStabilityPool.id;
  network = Network.ETHEREUM_MAINNET;
  groupLabel = 'Liquity Stability Pools';

  constructor(
    @Inject(APP_TOOLKIT) protected readonly appToolkit: IAppToolkit,
    @Inject(BProtocolContractFactory) protected readonly contractFactory: BProtocolContractFactory,
  ) {
    super(appToolkit);
  }

  getContract(address: string): BProtocolBamm {
    return this.contractFactory.bProtocolBamm({ address, network: this.network });
  }

  async getDefinitions(): Promise<DefaultContractPositionDefinition[]> {
    return [
      { address: '0x00ff66ab8699aafa050ee5ef5041d1503aa0849a' },
      { address: '0x0d3abaa7e088c2c82f54b2f47613da438ea8c598' },
      { address: '0x54bc9113f1f55cdbdf221daf798dc73614f6d972' },
    ];
  }

  async getTokenDefinitions() {
    return [
      { metaType: MetaType.SUPPLIED, address: '0x5f98805a4e8be255a32880fdec7f6728c6568ba0', network: this.network },
      { metaType: MetaType.SUPPLIED, address: ZERO_ADDRESS, network: this.network },
    ];
  }

  async getLabel({ contractPosition }: GetDisplayPropsParams<BProtocolBamm>) {
    return `${getLabelFromToken(contractPosition.tokens[0])} Stabilty Pool`;
  }

  async getTokenBalancesPerPosition({ address, contractPosition }: GetTokenBalancesParams<BProtocolBamm>) {
    const bammLensAddress = '0xfae2e2d3f11bab10ee0ddd0332f6dfe957414ccb';
    const contract = this.contractFactory.bProtocolBammLens({ address: bammLensAddress, network: this.network });
    const userDeposit = await contract.getUserDeposit(address, contractPosition.address);
    return [userDeposit.lusd, userDeposit.eth];
  }
}
