// Mock on-chain calls. Real Avalanche contracts plug in here later.
// Interface mirrors GameToken.sol / WarriorNFT.sol / RewardDistributor.sol.

export type WarriorClass = 'Validator' | 'Miner' | 'Bridger' | 'Staker' | 'Developer';

export interface Warrior {
  tokenId: string;
  class: WarriorClass;
  power: number;
  speed: number;
  defense: number;
  level: number;
  xp: number;
  health: number;
  emoji: string;
}

const CLASS_EMOJI: Record<WarriorClass, string> = {
  Validator: '🛡️',
  Miner: '⛏️',
  Bridger: '🌉',
  Staker: '💎',
  Developer: '⚡',
};

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function mintStarterWarriors(seed: string): Warrior[] {
  const classes: WarriorClass[] = ['Validator', 'Miner', 'Bridger'];
  return classes.map((c, i) => ({
    tokenId: `${seed}-${i}-${Date.now()}`,
    class: c,
    power: rand(50, 80),
    speed: rand(40, 90),
    defense: rand(30, 70),
    level: 1,
    xp: 0,
    health: 100,
    emoji: CLASS_EMOJI[c],
  }));
}

export function mintWarrior(klass: WarriorClass): Warrior {
  return {
    tokenId: `w-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    class: klass,
    power: rand(50, 90),
    speed: rand(40, 95),
    defense: rand(30, 80),
    level: 1,
    xp: 0,
    health: 100,
    emoji: CLASS_EMOJI[klass],
  };
}

// Mock balance helpers
export async function getArenaBalance(_address: string): Promise<number> {
  // In production: call GameToken.balanceOf
  return 0; // server-of-truth lives in arena_room_players.arena_tokens
}

export const WARRIOR_CLASSES: WarriorClass[] = ['Validator', 'Miner', 'Bridger', 'Staker', 'Developer'];
export const CLASS_META: Record<WarriorClass, { emoji: string; teaches: string }> = {
  Validator:  { emoji: '🛡️', teaches: 'Validators secure Avalanche L1s by participating in consensus.' },
  Miner:      { emoji: '⛏️', teaches: 'Miners generate ARENA tokens — like minting via the NativeMinter precompile.' },
  Bridger:    { emoji: '🌉', teaches: 'Bridgers move assets across chains using Avalanche Warp Messaging (ICM).' },
  Staker:     { emoji: '💎', teaches: 'Stakers lock tokens to defend validator nodes and earn rewards.' },
  Developer:  { emoji: '⚡', teaches: 'Developers deploy smart contracts and upgrade your chain.' },
};