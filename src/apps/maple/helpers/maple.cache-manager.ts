import { Injectable } from '@nestjs/common';
import { gql, GraphQLClient } from 'graphql-request';

import { CacheOnInterval } from '~cache/cache-on-interval.decorator';
import { Network } from '~types/network.interface';

import { MAPLE_DEFINITION } from '../maple.definition';

type MapleAllPoolsResponse = {
  allPools?: {
    list?: {
      id: string;
      poolName: string;
      symbol: string;
      lendingApy: string;
      farmingApy: string;
      stakeRewards: {
        id: string;
      };
      liquidityAsset: {
        address: string;
      };
    }[];
  };
};

const ALL_POOLS_QUERY = gql`
  {
    allPools {
      list {
        id
        poolName
        symbol
        lendingApy
        farmingApy
        stakeRewards {
          id
        }
        liquidityAsset {
          address
        }
      }
    }
  }
`;

@Injectable()
export class MapleCacheManager {
  @CacheOnInterval({
    key: `studio:${MAPLE_DEFINITION.id}:${MAPLE_DEFINITION.groups.pool.id}:${Network.ETHEREUM_MAINNET}:pool-data`,
    timeout: 15 * 60 * 1000,
    failOnMissingData: false,
  })
  async getCachedPoolData() {
    const client = new GraphQLClient('https://api.maple.finance/v1/graphql', {
      headers: { 'Content-Type': 'application/json' },
    });
    const pairsData = await client.request<MapleAllPoolsResponse>(ALL_POOLS_QUERY);

    return (pairsData.allPools?.list ?? []).map(v => ({
      poolName: v.poolName,
      apy: Number(v.lendingApy) + Number(v.farmingApy),
      poolAddress: v.id.toLowerCase(),
      farmAddress: v.stakeRewards.id.toLowerCase(),
    }));
  }
}
