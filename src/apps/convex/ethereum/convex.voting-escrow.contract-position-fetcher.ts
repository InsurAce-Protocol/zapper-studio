import { Inject } from '@nestjs/common';

import { APP_TOOLKIT, IAppToolkit } from '~app-toolkit/app-toolkit.interface';
import { PositionTemplate } from '~app-toolkit/decorators/position-template.decorator';
import { getLabelFromToken } from '~app-toolkit/helpers/presentation/image.present';
import { MetaType } from '~position/position.interface';
import { isSupplied } from '~position/position.utils';
import { ContractPositionTemplatePositionFetcher } from '~position/template/contract-position.template.position-fetcher';
import {
  GetDisplayPropsParams,
  GetTokenBalancesParams,
  GetTokenDefinitionsParams,
} from '~position/template/contract-position.template.types';

import { ConvexContractFactory } from '../contracts';
import { ConvexVotingEscrow } from '../contracts/ethers/ConvexVotingEscrow';

@PositionTemplate()
export class EthereumConvexVotingEscrowContractPositionFetcher extends ContractPositionTemplatePositionFetcher<ConvexVotingEscrow> {
  groupLabel = 'Vote Locked CVX';

  constructor(
    @Inject(APP_TOOLKIT) protected readonly appToolkit: IAppToolkit,
    @Inject(ConvexContractFactory) protected readonly contractFactory: ConvexContractFactory,
  ) {
    super(appToolkit);
  }

  getContract(address: string): ConvexVotingEscrow {
    return this.contractFactory.convexVotingEscrow({ address, network: this.network });
  }

  async getDefinitions() {
    return [{ address: '0x72a19342e8f1838460ebfccef09f6585e32db86e' }];
  }

  async getTokenDefinitions({ contract }: GetTokenDefinitionsParams<ConvexVotingEscrow>) {
    const stakedTokenAddress = await contract.stakingToken();
    const rewardTokenAddress = await contract.rewardTokens(0);

    return [
      {
        metaType: MetaType.SUPPLIED,
        address: stakedTokenAddress,
        network: this.network,
      },
      {
        metaType: MetaType.CLAIMABLE,
        address: rewardTokenAddress,
        network: this.network,
      },
    ];
  }

  async getLabel({ contractPosition }: GetDisplayPropsParams<ConvexVotingEscrow>) {
    const suppliedToken = contractPosition.tokens.find(isSupplied)!;
    return `Voting Escrow ${getLabelFromToken(suppliedToken)}`;
  }

  async getTokenBalancesPerPosition({ address, contract }: GetTokenBalancesParams<ConvexVotingEscrow>) {
    return Promise.all([
      contract.lockedBalances(address).then(v => v.total),
      contract.claimableRewards(address).then(v => v[0].amount),
    ]);
  }
}
