import { Register } from '~app-toolkit/decorators';
import { appDefinition, AppDefinition } from '~app/app.definition';
import { GroupType, AppAction, AppTag } from '~app/app.interface';
import { Network } from '~types/network.interface';

export const KWENTA_DEFINITION = appDefinition({
  id: 'kwenta',
  name: 'Kwenta',
  description:
    'Trade commodities, forex, crypto, and more with up to 25x leverage and deep liquidity without the risk of your assets being frozen.',
  url: 'https://kwenta.io/',
  groups: {
    isolated: {
      id: 'isolated',
      type: GroupType.POSITION,
      label: 'Isolated',
    },
    cross: {
      id: 'cross',
      type: GroupType.POSITION,
      label: 'Cross',
    },
    staking: {
      id: 'staking',
      type: GroupType.POSITION,
      label: 'Staking',
    },
    lpStaking: {
      id: 'lp-staking',
      type: GroupType.POSITION,
      label: 'LP Staking',
    },
  },
  tags: [AppTag.DERIVATIVES],
  keywords: [],
  links: {
    github: 'https://github.com/kwenta',
    twitter: 'https://twitter.com/kwenta_io',
    discord: 'https://discord.com/invite/kwenta',
  },

  supportedNetworks: {
    [Network.OPTIMISM_MAINNET]: [AppAction.VIEW],
  },

  primaryColor: '#fff',
  token: {
    address: '0x920cf626a271321c151d027030d5d08af699456b',
    network: Network.OPTIMISM_MAINNET,
  },
});

@Register.AppDefinition(KWENTA_DEFINITION.id)
export class KwentaAppDefinition extends AppDefinition {
  constructor() {
    super(KWENTA_DEFINITION);
  }
}

export default KWENTA_DEFINITION;
