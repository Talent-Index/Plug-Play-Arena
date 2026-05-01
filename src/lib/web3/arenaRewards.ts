// Mock reward distribution. Real RewardDistributor.sol plugs in here.
import { supabase } from '@/integrations/supabase/client';

export interface RewardSplit {
  winnerArena: number;
  runnerUpArena: number;
  participationArena: number;
}

export const DEFAULT_SPLIT: RewardSplit = {
  winnerArena: 500,
  runnerUpArena: 200,
  participationArena: 50,
};

export interface FinalStanding {
  playerId: string;
  userId: string | null;
  nickname: string;
  walletAddress: string | null;
  score: number;
  rank: number;
  arenaEarned: number;
  xpEarned: number;
}

export function computeStandings(
  players: Array<{ id: string; user_id: string | null; nickname: string; score: number; territories: number; chain_health: number }>,
  walletByPlayer: Record<string, string | null>,
  split: RewardSplit = DEFAULT_SPLIT,
): FinalStanding[] {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.territories !== a.territories) return b.territories - a.territories;
    return b.chain_health - a.chain_health;
  });
  return sorted.map((p, i) => {
    const rank = i + 1;
    const arena = rank === 1 ? split.winnerArena : rank === 2 ? split.runnerUpArena : split.participationArena;
    return {
      playerId: p.id,
      userId: p.user_id,
      nickname: p.nickname,
      walletAddress: walletByPlayer[p.id] ?? null,
      score: p.score,
      rank,
      arenaEarned: arena,
      xpEarned: rank === 1 ? 300 : rank === 2 ? 150 : 75,
    };
  });
}

/** In production: call RewardDistributor.settleMatch on Avalanche Fuji. */
export async function settleMatchOnChain(_matchId: string, _standings: FinalStanding[]): Promise<{ txHash: string }> {
  // Mock: pretend we minted ARENA + recorded battles on-chain.
  await new Promise((r) => setTimeout(r, 400));
  return { txHash: '0xmock' + Math.random().toString(16).slice(2, 10) };
}

export async function recordMatchResult(roomId: string, mode: string, standings: FinalStanding[], concepts: string[]) {
  const winner = standings[0];
  const total = standings.reduce((s, p) => s + p.arenaEarned, 0);
  await supabase.from('arena_match_results').insert({
    room_id: roomId,
    mode,
    winner_player_id: winner?.playerId ?? null,
    winner_nickname: winner?.nickname ?? null,
    winner_user_id: winner?.userId ?? null,
    standings: standings as unknown as Record<string, unknown>[],
    concepts: concepts as unknown as Record<string, unknown>[],
    arena_distributed: total,
  });
}