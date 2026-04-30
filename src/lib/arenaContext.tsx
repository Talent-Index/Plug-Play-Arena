import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/lib/playerContext';

export interface ArenaQuestion {
  id: string; topic: string; question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string; difficulty: string;
}
export interface ArenaPlayer {
  id: string; session_id: string; user_id: string | null;
  nickname: string; wallet_address: string | null; score: number; joined_at: string;
}
export interface ArenaSession {
  id: string; host_user_id: string;
  status: 'lobby' | 'live' | 'finished';
  join_code: string; current_question_index: number;
  question_started_at: string | null;
  winner_player_id: string | null;
  event_id: string | null;
  topic: string | null;
  created_at: string;
}
type Phase = 'idle' | 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished';

interface ArenaCtx {
  session: ArenaSession | null;
  players: ArenaPlayer[];
  questions: ArenaQuestion[];
  currentQuestion: ArenaQuestion | null;
  myPlayer: ArenaPlayer | null;
  phase: Phase;
  timeLeft: number;
  myAnswer: string | null;
  answerCounts: Record<string, number>;
  isHost: boolean;
  joining: boolean;
  createSession: () => Promise<string>;
  joinSession: (code: string, nickname: string, wallet?: string | null) => Promise<void>;
  attachWallet: (wallet: string) => Promise<void>;
  startGame: () => Promise<void>;
  submitAnswer: (answer: string, responseTimeMs: number) => Promise<void>;
  nextQuestion: () => Promise<void>;
  showLeaderboard: () => void;
  finishGame: () => Promise<void>;
  resetSession: () => void;
}

const Ctx = createContext<ArenaCtx | null>(null);
export const useArena = () => { const c = useContext(Ctx); if (!c) throw new Error('useArena outside provider'); return c; };

const QUESTION_TIME = 15;
const REVEAL_TIME = 4;
const GUEST_PLAYER_KEY = 'arena.guestPlayerIds'; // { [sessionId]: playerId }

function loadGuestMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(GUEST_PLAYER_KEY) || '{}'); } catch { return {}; }
}
function saveGuestPlayer(sessionId: string, playerId: string) {
  const m = loadGuestMap(); m[sessionId] = playerId;
  localStorage.setItem(GUEST_PLAYER_KEY, JSON.stringify(m));
}

export function ArenaProvider({ children }: { children: ReactNode }) {
  const { user } = usePlayer();
  const [session, setSession] = useState<ArenaSession | null>(null);
  const [players, setPlayers] = useState<ArenaPlayer[]>([]);
  const [questions, setQuestions] = useState<ArenaQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const isHost = !!(user && session && session.host_user_id === user.id);
  const currentQuestion = session && questions.length > 0 ? questions[session.current_question_index] ?? null : null;
  const myPlayer = players.find(p => p.id === myPlayerId) ?? null;

  const sortPlayers = (rows: ArenaPlayer[]) =>
    [...rows].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));

  const refreshPlayers = useCallback(async (sid?: string) => {
    const id = sid ?? session?.id;
    if (!id) return;
    const { data } = await supabase.from('arena_players').select('*').eq('session_id', id);
    if (data) setPlayers(sortPlayers(data as ArenaPlayer[]));
  }, [session?.id]);

  const refreshAnswerCounts = useCallback(async () => {
    if (!session || !currentQuestion) return;
    const { data } = await supabase.from('arena_answers').select('selected_answer')
      .eq('session_id', session.id).eq('question_id', currentQuestion.id);
    if (data) {
      const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      data.forEach((a: { selected_answer: string }) => { counts[a.selected_answer] = (counts[a.selected_answer] || 0) + 1; });
      setAnswerCounts(counts);
    }
  }, [session?.id, currentQuestion?.id]);

  // Apply session row → derive phase (drives shared timer + sync across host/players)
  const applySession = useCallback((s: ArenaSession) => {
    setSession(s);
    if (s.status === 'finished') { setPhase('finished'); return; }
    if (s.status === 'lobby') { setPhase('lobby'); return; }
    if (s.status === 'live' && s.question_started_at) {
      const elapsed = (Date.now() - new Date(s.question_started_at).getTime()) / 1000;
      if (elapsed < QUESTION_TIME) setPhase('question');
      else if (elapsed < QUESTION_TIME + REVEAL_TIME) setPhase('reveal');
      else setPhase('leaderboard');
    }
  }, []);

  // Realtime — only after session.id is set
  useEffect(() => {
    if (!session?.id) return;
    const sid = session.id;
    const ch = supabase.channel(`arena-${sid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${sid}` },
        (payload) => {
          const s = payload.new as ArenaSession;
          // Reset per-question state when index changes
          setSession(prev => {
            if (prev && prev.current_question_index !== s.current_question_index) {
              setMyAnswer(null);
              setAnswerCounts({ A: 0, B: 0, C: 0, D: 0 });
            }
            return s;
          });
          applySession(s);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_players', filter: `session_id=eq.${sid}` },
        () => refreshPlayers(sid))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arena_answers', filter: `session_id=eq.${sid}` },
        () => refreshAnswerCounts())
      .subscribe();
    refreshPlayers(sid);
    return () => { supabase.removeChannel(ch); };
  }, [session?.id, applySession, refreshPlayers, refreshAnswerCounts]);

  // Shared timer — based on session.question_started_at
  useEffect(() => {
    if (!session?.question_started_at || session.status !== 'live') return;
    const start = new Date(session.question_started_at).getTime();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (elapsed >= QUESTION_TIME && phase === 'question') setPhase('reveal');
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [session?.question_started_at, session?.status, phase]);

  const loadQuestions = async (topic?: string | null) => {
    let q = supabase.from('arena_questions').select('*');
    if (topic) q = q.eq('topic', topic);
    else q = q.limit(10);
    const { data } = await q;
    setQuestions((data ?? []) as ArenaQuestion[]);
  };

  const createSession = useCallback(async () => {
    if (!user) throw new Error('Sign in to host');
    const joinCode = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabase.from('game_sessions')
      .insert({ host_user_id: user.id, join_code: joinCode }).select().single();
    if (error) throw error;
    const s = data as ArenaSession;
    await loadQuestions();
    setSession(s); setPhase('lobby');
    return joinCode;
  }, [user]);

  const joinSession = useCallback(async (code: string, nickname: string, wallet?: string | null) => {
    const cleanWallet = wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet) ? wallet : null;
    setJoining(true);
    try {
      const { data: s, error } = await supabase.from('game_sessions').select('*').eq('join_code', code).maybeSingle();
      if (error || !s) throw new Error('Session not found');
      const sess = s as ArenaSession;
      if (sess.status === 'finished') throw new Error('Game already finished');
      // Store topic for question loading below

      // Reuse existing player: by user_id (signed in) OR by guest playerId in localStorage.
      let existing: ArenaPlayer | null = null;
      if (user) {
        const { data } = await supabase.from('arena_players').select('*')
          .eq('session_id', sess.id).eq('user_id', user.id).maybeSingle();
        existing = (data as ArenaPlayer) ?? null;
      } else {
        const guestId = loadGuestMap()[sess.id];
        if (guestId) {
          const { data } = await supabase.from('arena_players').select('*')
            .eq('id', guestId).maybeSingle();
          existing = (data as ArenaPlayer) ?? null;
        }
      }

      let player: ArenaPlayer;
      if (existing) {
        player = existing;
        if (cleanWallet && player.wallet_address !== cleanWallet) {
          await supabase.rpc('arena_attach_wallet', { _player_id: player.id, _wallet: cleanWallet });
          player = { ...player, wallet_address: cleanWallet };
        }
      } else {
        const { data: p, error: pErr } = await supabase.from('arena_players')
          .insert({ session_id: sess.id, user_id: user?.id ?? null, nickname, wallet_address: cleanWallet })
          .select().single();
        if (pErr) throw pErr;
        player = p as ArenaPlayer;
        if (!user) saveGuestPlayer(sess.id, player.id);
      }

      await loadQuestions(sess.topic);
      setMyPlayerId(player.id);
      setSession(sess);
      applySession(sess);
    } finally { setJoining(false); }
  }, [user, applySession]);

  const startGame = useCallback(async () => {
    if (!session || !isHost) return;
    await supabase.from('game_sessions').update({
      status: 'live', current_question_index: 0,
      question_started_at: new Date().toISOString(),
    }).eq('id', session.id);
    setMyAnswer(null);
    setAnswerCounts({ A: 0, B: 0, C: 0, D: 0 });
  }, [session, isHost]);

  const submitAnswer = useCallback(async (answer: string, responseTimeMs: number) => {
    if (!session || !myPlayerId || !currentQuestion || myAnswer) return;
    setMyAnswer(answer); // optimistic UI lock
    const { error } = await supabase.rpc('arena_submit_answer', {
      _session_id: session.id, _player_id: myPlayerId,
      _question_id: currentQuestion.id, _selected_answer: answer,
      _response_time_ms: responseTimeMs,
    });
    if (error) {
      // If already answered, keep lock; else revert
      if (!String(error.message).includes('Already answered')) setMyAnswer(null);
    }
  }, [session, myPlayerId, currentQuestion, myAnswer]);

  const showLeaderboard = useCallback(() => {
    setPhase('leaderboard');
    if (session?.id) refreshPlayers(session.id);
  }, [session?.id, refreshPlayers]);

  const nextQuestion = useCallback(async () => {
    if (!session || !isHost) return;
    const next = session.current_question_index + 1;
    if (next >= questions.length) { await finishGame(); return; }
    await supabase.from('game_sessions').update({
      current_question_index: next,
      question_started_at: new Date().toISOString(),
    }).eq('id', session.id);
  }, [session, isHost, questions.length]);

  const finishGame = useCallback(async () => {
    if (!session || !isHost) return;
    await supabase.from('game_sessions').update({ status: 'finished' }).eq('id', session.id);
    if (session.id) refreshPlayers(session.id);
  }, [session, isHost, refreshPlayers]);

  const resetSession = useCallback(() => {
    setSession(null); setPlayers([]); setQuestions([]);
    setPhase('idle'); setMyAnswer(null); setMyPlayerId(null);
    setAnswerCounts({}); setTimeLeft(QUESTION_TIME);
  }, []);

  const attachWallet = useCallback(async (wallet: string) => {
    if (!myPlayerId) throw new Error('No player in session');
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) throw new Error('Invalid wallet address');
    const { error } = await supabase.rpc('arena_attach_wallet', { _player_id: myPlayerId, _wallet: wallet });
    if (error) throw error;
    if (session?.id) refreshPlayers(session.id);
  }, [myPlayerId, session?.id, refreshPlayers]);

  return (
    <Ctx.Provider value={{
      session, players, questions, currentQuestion, myPlayer, phase, timeLeft,
      myAnswer, answerCounts, isHost, joining,
      createSession, joinSession, attachWallet, startGame, submitAnswer,
      nextQuestion, showLeaderboard, finishGame, resetSession,
    }}>{children}</Ctx.Provider>
  );
}
