import { Inject } from '@nestjs/common';
import { getAddress } from 'ethers/lib/utils';

import { drillBalance } from '~app-toolkit';
import { IAppToolkit, APP_TOOLKIT } from '~app-toolkit/app-toolkit.interface';
import { Register } from '~app-toolkit/decorators';
import { presentBalanceFetcherResponse } from '~app-toolkit/helpers/presentation/balance-fetcher-response.present';
import { UniswapV3LiquidityContractPositionBuilder } from '~apps/uniswap-v3/common/uniswap-v3.liquidity.contract-position-builder';
import { BalanceFetcher } from '~balance/balance-fetcher.interface';
import { ContractPositionBalance, TokenBalance } from '~position/position-balance.interface';
import { claimable } from '~position/position.utils';
import { Network } from '~types/network.interface';

import { accountBalancesQuery, CompoundorAccountBalances } from '../graphql/accountBalancesQuery';
import { accountCompoundingTokensQuery, CompoundingAccountTokens } from '../graphql/accountCompoundingTokensQuery';
import { generateGraphUrlForNetwork } from '../graphql/graphUrlGenerator';
import {
  getCompoundingContractPosition,
  getCompoundorRewardsContractPosition,
} from '../helpers/contractPositionParser';
import { REVERT_FINANCE_DEFINITION } from '../revert-finance.definition';

const network = Network.ETHEREUM_MAINNET;

@Register.BalanceFetcher(REVERT_FINANCE_DEFINITION.id, network)
export class EthereumRevertFinanceBalanceFetcher implements BalanceFetcher {
  constructor(
    @Inject(APP_TOOLKIT) private readonly appToolkit: IAppToolkit,
    @Inject(UniswapV3LiquidityContractPositionBuilder)
    private readonly uniswapV3LiquidityContractPositionBuilder: UniswapV3LiquidityContractPositionBuilder,
  ) {}

  async getCompoundorRewardBalances(address: string) {
    const graphHelper = this.appToolkit.helpers.theGraphHelper;
    const data = await graphHelper.requestGraph<CompoundorAccountBalances>({
      endpoint: generateGraphUrlForNetwork(network),
      query: accountBalancesQuery,
      variables: { address: getAddress(address) },
    });
    if (!data) return [];
    const baseTokens = await this.appToolkit.getBaseTokenPrices(network);
    const accountRewardsBalances: Array<TokenBalance> = [];
    data.accountBalances.forEach(({ token, balance }) => {
      const existingToken = baseTokens.find(item => item.address === token)!;
      if (!existingToken) return;
      accountRewardsBalances.push(drillBalance(claimable(existingToken), balance));
    });
    return [getCompoundorRewardsContractPosition(network, accountRewardsBalances)];
  }

  async getCompoundingAccountTokens(address: string) {
    const graphHelper = this.appToolkit.helpers.theGraphHelper;
    const data = await graphHelper.requestGraph<CompoundingAccountTokens>({
      endpoint: generateGraphUrlForNetwork(network),
      query: accountCompoundingTokensQuery,
      variables: { address: getAddress(address) },
    });
    if (!data) return [];
    const multicall = this.appToolkit.getMulticall(network);
    const compoundingBalances: Array<ContractPositionBalance> = [];
    const tokenLoader = this.appToolkit.getTokenDependencySelector();

    await Promise.all(
      data.tokens.map(async ({ id }) => {
        const uniV3Token = await this.uniswapV3LiquidityContractPositionBuilder.buildPosition({
          positionId: id,
          network,
          multicall,
          tokenLoader,
          collapseClaimable: true,
        });

        if (!uniV3Token) return;
        const position = getCompoundingContractPosition(network, uniV3Token);
        compoundingBalances.push({
          key: this.appToolkit.getPositionKey(position, ['compoundingPositionId']),
          ...position,
        });
      }),
    );
    return compoundingBalances;
  }

  async getBalances(address: string) {
    const [compoundorRewardsBalances, compoundingAccountBalances] = await Promise.all([
      this.getCompoundorRewardBalances(address),
      this.getCompoundingAccountTokens(address),
    ]);

    return presentBalanceFetcherResponse([
      {
        label: 'Compoundor rewards',
        assets: compoundorRewardsBalances,
      },
      {
        label: 'Compounding positions',
        assets: compoundingAccountBalances,
      },
    ]);
  }
}
