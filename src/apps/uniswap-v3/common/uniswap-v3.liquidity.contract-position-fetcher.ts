import { Inject, NotImplementedException } from '@nestjs/common';
import { gql } from 'graphql-request';
import { compact, range } from 'lodash';

import { APP_TOOLKIT, IAppToolkit } from '~app-toolkit/app-toolkit.interface';
import { getLabelFromToken } from '~app-toolkit/helpers/presentation/image.present';
import { ContractPositionBalance } from '~position/position-balance.interface';
import { ContractPosition, MetaType, Standard } from '~position/position.interface';
import {
  GetDataPropsParams,
  GetDisplayPropsParams,
  GetTokenDefinitionsParams,
} from '~position/template/contract-position.template.types';
import { CustomContractPositionTemplatePositionFetcher } from '~position/template/custom-contract-position.template.position-fetcher';

import { UniswapV3ContractFactory, UniswapV3PositionManager } from '../contracts';

import { UniswapV3LiquidityContractPositionBuilder } from './uniswap-v3.liquidity.contract-position-builder';

export type UniswapV3LiquidityPositionDataProps = {
  feeTier: number;
  liquidity: number;
  reserves: number[];
  poolAddress: string;
  assetStandard: Standard.ERC_721;
  rangeStart?: number;
  rangeEnd?: number;
};

export type UniswapV3LiquidityPositionDefinition = {
  address: string;
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  feeTier: number;
};

type GetTopPoolsResponse = {
  pools: {
    id: string;
    feeTier: string;
    token0: {
      id: string;
    };
    token1: {
      id: string;
    };
  }[];
};

const GET_TOP_POOLS_QUERY = gql`
  query topPools {
    pools(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc, subgraphError: allow) {
      id
      feeTier
      token0 {
        id
      }
      token1 {
        id
      }
    }
  }
`;

export abstract class UniswapV3LiquidityContractPositionFetcher extends CustomContractPositionTemplatePositionFetcher<
  UniswapV3PositionManager,
  UniswapV3LiquidityPositionDataProps,
  UniswapV3LiquidityPositionDefinition
> {
  abstract subgraphUrl: string;
  abstract positionManagerAddress: string;
  abstract factoryAddress: string;

  constructor(
    @Inject(APP_TOOLKIT) protected readonly appToolkit: IAppToolkit,
    @Inject(UniswapV3ContractFactory) protected readonly contractFactory: UniswapV3ContractFactory,
    @Inject(UniswapV3LiquidityContractPositionBuilder)
    protected readonly uniswapV3LiquidityContractPositionBuilder: UniswapV3LiquidityContractPositionBuilder,
  ) {
    super(appToolkit);
  }

  getContract(address: string): UniswapV3PositionManager {
    return this.contractFactory.uniswapV3PositionManager({ address, network: this.network });
  }

  async getDefinitions(): Promise<UniswapV3LiquidityPositionDefinition[]> {
    const data = await this.appToolkit.helpers.theGraphHelper.requestGraph<GetTopPoolsResponse>({
      endpoint: this.subgraphUrl,
      query: GET_TOP_POOLS_QUERY,
    });

    return data.pools.map(v => ({
      address: this.positionManagerAddress,
      poolAddress: v.id.toLowerCase(),
      token0Address: v.token0.id.toLowerCase(),
      token1Address: v.token1.id.toLowerCase(),
      feeTier: Number(v.feeTier) / 10 ** 4,
    }));
  }

  async getTokenDefinitions({
    definition,
  }: GetTokenDefinitionsParams<UniswapV3PositionManager, UniswapV3LiquidityPositionDefinition>) {
    return [
      {
        metaType: MetaType.SUPPLIED,
        address: definition.token0Address,
        network: this.network,
      },
      {
        metaType: MetaType.SUPPLIED,
        address: definition.token1Address,
        network: this.network,
      },
    ];
  }

  async getDataProps({
    multicall,
    contractPosition,
    definition,
  }: GetDataPropsParams<
    UniswapV3PositionManager,
    UniswapV3LiquidityPositionDataProps,
    UniswapV3LiquidityPositionDefinition
  >): Promise<UniswapV3LiquidityPositionDataProps> {
    const { poolAddress, feeTier } = definition;
    const { tokens } = contractPosition;

    const [reserveRaw0, reserveRaw1] = await Promise.all([
      multicall.wrap(this.contractFactory.erc20(tokens[0])).balanceOf(poolAddress),
      multicall.wrap(this.contractFactory.erc20(tokens[1])).balanceOf(poolAddress),
    ]);

    const reservesRaw = [reserveRaw0, reserveRaw1];
    const reserves = reservesRaw.map((r, i) => Number(r) / 10 ** tokens[i].decimals);
    const liquidity = reserves[0] * tokens[0].price + reserves[1] * tokens[1].price;
    const assetStandard = Standard.ERC_721;

    return { feeTier, reserves, liquidity, poolAddress, assetStandard };
  }

  async getLabel({
    contractPosition,
    definition,
  }: GetDisplayPropsParams<
    UniswapV3PositionManager,
    UniswapV3LiquidityPositionDataProps,
    UniswapV3LiquidityPositionDefinition
  >): Promise<string> {
    const symbolLabel = contractPosition.tokens.map(t => getLabelFromToken(t)).join(' / ');
    const label = `${symbolLabel} (${definition.feeTier.toFixed(2)}%)`;
    return label;
  }

  getKey({ contractPosition }: { contractPosition: ContractPosition<UniswapV3LiquidityPositionDataProps> }) {
    return this.appToolkit.getPositionKey(contractPosition, ['feeTier']);
  }

  // @ts-ignore
  async getTokenBalancesPerPosition() {
    throw new NotImplementedException();
  }

  async getBalances(address: string): Promise<ContractPositionBalance<UniswapV3LiquidityPositionDataProps>[]> {
    // @TODO: Rely on contract positions when we can correctly index all pools
    const multicall = this.appToolkit.getMulticall(this.network);
    const tokenLoader = this.appToolkit.getTokenDependencySelector({
      tags: { network: this.network, context: `${this.appId}__template_balances` },
    });

    const positionManager = this.contractFactory.uniswapV3PositionManager({
      address: this.positionManagerAddress,
      network: this.network,
    });

    const numPositionsRaw = await positionManager.balanceOf(address);
    const balances = await Promise.all(
      range(0, numPositionsRaw.toNumber()).map(async index =>
        this.uniswapV3LiquidityContractPositionBuilder.buildPosition({
          positionId: await multicall.wrap(positionManager).tokenOfOwnerByIndex(address, index),
          network: this.network,
          multicall,
          tokenLoader,
        }),
      ),
    );

    return compact(balances);
  }
}
