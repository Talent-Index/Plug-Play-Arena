export type ArenaMode = 'chain_builder' | 'token_wars' | 'nft_raid' | 'warp_bridge' | 'validator_siege';

export interface ModeMeta {
  id: ArenaMode;
  title: string;
  emoji: string;
  tagline: string;
  teaches: string[];
  primaryAction: string;
}

export const MODES: ModeMeta[] = [
  {
    id: 'chain_builder',
    title: 'Chain Builder',
    emoji: '🏗️',
    tagline: 'Build your L1, add validators, earn fees.',
    teaches: ['Avalanche L1s', 'Validator sets', 'ACP-77'],
    primaryAction: 'Upgrade Chain',
  },
  {
    id: 'token_wars',
    title: 'Token Wars',
    emoji: '🪙',
    tagline: 'Mint and spend ARENA to upgrade your chain.',
    teaches: ['ERC-20 tokens', 'NativeMinter precompile', 'Token utility'],
    primaryAction: 'Mine Tokens',
  },
  {
    id: 'nft_raid',
    title: 'NFT Raid',
    emoji: '⚔️',
    tagline: 'Deploy NFT warriors. Raid enemy chains.',
    teaches: ['ERC-721', 'NFT gaming assets', 'Ownership'],
    primaryAction: 'Attack Tile',
  },
  {
    id: 'warp_bridge',
    title: 'Warp Bridge Rush',
    emoji: '🌉',
    tagline: 'Bridge resources across chain zones before time runs out.',
    teaches: ['Avalanche Warp Messaging', 'Cross-chain (ICM)'],
    primaryAction: 'Bridge Resources',
  },
  {
    id: 'validator_siege',
    title: 'Validator Siege',
    emoji: '🛡️',
    tagline: 'Stake tokens, defend nodes, protect uptime.',
    teaches: ['Staking', 'Validator management', 'Network security'],
    primaryAction: 'Defend Validator',
  },
];

export function getMode(id: string): ModeMeta {
  return MODES.find(m => m.id === id) ?? MODES[0];
}

export const CHAIN_COLORS = ['#FF394A', '#3055B3', '#22c55e', '#f59e0b'];
export const CHAIN_NAMES = ['Crimson L1', 'Cobalt L1', 'Verdant L1', 'Solar L1'];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const BOARD_COLS = 5;
export const BOARD_ROWS = 4;

export interface Tile {
  r: number;
  c: number;
  ownerPlayerId: string | null;
  health: number;
  isBase: boolean;
}

export function emptyBoard(): Tile[] {
  const t: Tile[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      t.push({ r, c, ownerPlayerId: null, health: 0, isBase: false });
    }
  }
  return t;
}