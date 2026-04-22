import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Persona, AvalancheGame } from './avalanche';
import { difficultyMultiplier, rarityFor } from './scoring';

// ─── Profile shape (Cloud-backed) ────────────────────────────────────
export interface CloudProfile {
  user_id: string;
  username: string;
  emoji: string;
  persona: Persona;
  wallet_address: string | null;
  xp: number;
  level: number;
  stage: string;
  streak: number;
  status_tag: string | null;
}

export interface NFTRow { id: string; title: string; rarity: string; emoji: string; minted_at: string; event_id: string | null; game_id: string | null; }
export interface RewardRow {
  id: string; title: string; description: string | null; kind: string; rarity: string;
  value: string | null; claimed: boolean; claimed_at: string | null; event_id: string | null;
}

interface SubmitArgs {
  game: AvalancheGame;
  accuracyPct: number;
  durationMs: number;
  attemptsUsed: number;
  eventId?: string | null;
  roundId?: string | null;
}

interface SubmitResult {
  attemptId: string;
  score: number;
  perfect: boolean;
  fast: boolean;
  newXp: number;
  nft?: NFTRow;
  reward?: RewardRow;
}

interface PlayerContextValue {
  user: User | null;
  session: Session | null;
  profile: CloudProfile | null;
  loading: boolean;

  nfts: NFTRow[];
  rewards: RewardRow[];

  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRewards: () => Promise<void>;
  refreshNfts: () => Promise<void>;

  updatePersona: (persona: Persona) => Promise<void>;
  updateProfileMeta: (patch: Partial<Pick<CloudProfile, 'username' | 'emoji' | 'wallet_address'>>) => Promise<void>;

  submitMission: (args: SubmitArgs) => Promise<SubmitResult>;
  claimReward: (id: string) => Promise<void>;
  joinEvent: (eventId: string, teamId?: string | null) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [nfts, setNfts] = useState<NFTRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Auth wiring ──────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess) {
        setProfile(null); setNfts([]); setRewards([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── Load profile/nfts/rewards on user change ────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_my_profile');
    if (data && data[0]) setProfile(data[0] as CloudProfile);
  }, [user]);

  const refreshNfts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('nft_badges').select('*').eq('user_id', user.id).order('minted_at', { ascending: false });
    if (data) setNfts(data as NFTRow[]);
  }, [user]);

  const refreshRewards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('rewards').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setRewards(data as RewardRow[]);
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshProfile();
      refreshNfts();
      refreshRewards();
    }
  }, [user, refreshProfile, refreshNfts, refreshRewards]);

  // ─── Realtime sync of own profile ────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`profile-self-${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
        () => refreshProfile())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nft_badges', filter: `user_id=eq.${user.id}` },
        () => refreshNfts())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rewards', filter: `user_id=eq.${user.id}` },
        () => refreshRewards())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refreshProfile, refreshNfts, refreshRewards]);

  // ─── Mutators ────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null); setNfts([]); setRewards([]);
  }, []);

  const updatePersona = useCallback(async (persona: Persona) => {
    if (!user) return;
    await supabase.from('profiles').update({ persona }).eq('user_id', user.id);
    refreshProfile();
  }, [user, refreshProfile]);

  const updateProfileMeta = useCallback(async (patch: Partial<Pick<CloudProfile, 'username' | 'emoji' | 'wallet_address'>>) => {
    if (!user) return;
    await supabase.from('profiles').update(patch).eq('user_id', user.id);
    refreshProfile();
  }, [user, refreshProfile]);

  const joinEvent = useCallback(async (eventId: string, teamId?: string | null) => {
    if (!user) return;
    await supabase.from('event_participants').upsert({
      event_id: eventId, user_id: user.id, team_id: teamId ?? null,
    }, { onConflict: 'event_id,user_id' });
  }, [user]);

  const submitMission = useCallback(async ({ game, accuracyPct, durationMs, attemptsUsed, eventId, roundId }: SubmitArgs): Promise<SubmitResult> => {
    if (!user) throw new Error('Not signed in');
    const mult = difficultyMultiplier(game.difficulty);
    const timeLimit = parseDurationMin(game.duration) * 60;

    const { data, error } = await supabase.rpc('submit_attempt', {
      _game_id: game.id,
      _event_id: eventId ?? null,
      _round_id: roundId ?? null,
      _accuracy_pct: accuracyPct,
      _duration_ms: durationMs,
      _difficulty_multiplier: mult,
      _attempts_used: attemptsUsed,
      _time_limit_seconds: timeLimit,
      _xp_reward: game.xpReward,
    });
    if (error) throw error;
    const res = data as { attempt_id: string; score: number; perfect: boolean; fast: boolean; new_xp: number };

    const out: SubmitResult = {
      attemptId: res.attempt_id, score: res.score,
      perfect: res.perfect, fast: res.fast, newXp: res.new_xp,
    };

    // Mint NFT if game awards one
    if (game.rewardType === 'nft') {
      const { data: nftId } = await supabase.rpc('mint_badge', {
        _attempt_id: res.attempt_id, _title: `${game.title} Badge`,
        _rarity: rarityFor(game.difficulty), _emoji: game.emoji,
        _game_id: game.id, _event_id: eventId ?? null,
      });
      if (nftId) {
        const { data: nft } = await supabase.from('nft_badges').select('*').eq('id', nftId as string).maybeSingle();
        if (nft) out.nft = nft as NFTRow;
      }
    }
    if (game.rewardType === 'merch') {
      const { data: rId } = await supabase.rpc('issue_reward', {
        _attempt_id: res.attempt_id, _title: `${game.title} Merch Voucher`,
        _description: 'Redeem at the event booth.', _kind: 'merch', _rarity: rarityFor(game.difficulty),
        _value: 'Merch Pack', _event_id: eventId ?? null,
      });
      if (rId) {
        const { data: r } = await supabase.from('rewards').select('*').eq('id', rId as string).maybeSingle();
        if (r) out.reward = r as RewardRow;
      }
    }
    if (game.rewardType === 'token') {
      const { data: rId } = await supabase.rpc('issue_reward', {
        _attempt_id: res.attempt_id, _title: 'AVAX Reward',
        _description: 'Claim to your Core wallet.', _kind: 'token',
        _rarity: rarityFor(game.difficulty), _value: '0.1 AVAX',
        _event_id: eventId ?? null,
      });
      if (rId) {
        const { data: r } = await supabase.from('rewards').select('*').eq('id', rId as string).maybeSingle();
        if (r) out.reward = r as RewardRow;
      }
    }

    refreshProfile(); refreshNfts(); refreshRewards();
    return out;
  }, [user, refreshProfile, refreshNfts, refreshRewards]);

  const claimReward = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('rewards').update({ claimed: true, claimed_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id);
    refreshRewards();
  }, [user, refreshRewards]);

  return (
    <PlayerContext.Provider value={{
      user, session, profile, loading,
      nfts, rewards,
      signOut, refreshProfile, refreshRewards, refreshNfts,
      updatePersona, updateProfileMeta,
      submitMission, claimReward, joinEvent,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

function parseDurationMin(s: string): number {
  const m = /(\d+)\s*min/.exec(s);
  return m ? parseInt(m[1], 10) : 5;
}

// Convenience: derive list of mission ids the user has completed (for UI)
export function useCompletedMissionIds() {
  const { user } = usePlayer();
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    supabase.from('mission_attempts').select('game_id').eq('user_id', user.id).eq('status', 'completed')
      .then(({ data }) => { if (data) setIds(new Set(data.map((r: { game_id: string }) => r.game_id))); });
  }, [user]);
  return ids;
}

