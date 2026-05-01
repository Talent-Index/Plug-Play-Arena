import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { Button } from '@/components/ui/button';
import { ChainMap } from '@/components/arena/ChainMap';
import { ResourceDashboard } from '@/components/arena/ResourceDashboard';
import { TurnPanel } from '@/components/arena/TurnPanel';
import { BattleLog, type LogEntry } from '@/components/arena/BattleLog';
import { LearningModal } from '@/components/arena/LearningModal';
import { WarriorCard } from '@/components/arena/WarriorCard';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/lib/playerContext';
import { Tile, getMode, BOARD_ROWS, BOARD_COLS } from '@/lib/arena/modes';
import { Warrior } from '@/lib/web3/mockContracts';
import { toast } from 'sonner';
import { Copy, Play } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface RoomRow {
  id: string; code: string; host_user_id: string; mode: string; status: string;
  max_players: number; event_mode: boolean; turn_seconds: number; actions_per_turn: number;
  max_rounds: number; current_round: number; current_player_id: string | null;
  actions_remaining: number; turn_started_at: string | null; board: Tile[];
}
interface PlayerRow {
  id: string; room_id: string; user_id: string | null; nickname: string; emoji: string;
  chain_color: string; seat: number; is_ready: boolean; is_bot: boolean;
  arena_tokens: number; energy: number; validators: number; chain_health: number;
  warriors: Warrior[]; territories: number; score: number; xp_earned: number;
}

export default function AvalancheArenaPlay() {
  const [params] = useSearchParams();
  const roomId = params.get('room');
  const myPlayerId = params.get('player');
  const navigate = useNavigate();
  const { user } = usePlayer();

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number } | null>(null);
  const [selectedWarrior, setSelectedWarrior] = useState<string | null>(null);
  const [learning, setLearning] = useState<{ open: boolean; title: string; body: string }>({ open: false, title: '', body: '' });

  const me = useMemo(() => players.find((p) => p.id === myPlayerId) ?? null, [players, myPlayerId]);
  const isHost = !!(room && user && room.host_user_id === user.id);
  const isMyTurn = !!(room && me && room.current_player_id === me.id);
  const playerColors = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.chain_color])), [players]);

  // ── Initial fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    supabase.from('arena_rooms').select('*').eq('id', roomId).maybeSingle()
      .then(({ data }) => { if (data) setRoom(data as unknown as RoomRow); });
    supabase.from('arena_room_players').select('*').eq('room_id', roomId).order('seat')
      .then(({ data }) => { if (data) setPlayers(data as unknown as PlayerRow[]); });
    supabase.from('arena_room_events').select('*').eq('room_id', roomId).order('created_at', { ascending: true }).limit(80)
      .then(({ data }) => { if (data) setEvents(data.map((e) => ({ id: e.id, kind: e.kind, message: e.message, created_at: e.created_at }))); });
  }, [roomId]);

  // ── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`arena-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const next = payload.new as unknown as RoomRow | null;
        if (next) setRoom(next);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_room_players', filter: `room_id=eq.${roomId}` }, (payload: { new: unknown; old: unknown; eventType?: string }) => {
        const np = payload.new as PlayerRow | null;
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string };
          setPlayers((ps) => ps.filter((p) => p.id !== old.id));
        } else if (np && np.id) {
          setPlayers((ps) => {
            const i = ps.findIndex((p) => p.id === np.id);
            if (i === -1) return [...ps, np].sort((a, b) => a.seat - b.seat);
            const next = [...ps]; next[i] = np; return next;
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arena_room_events', filter: `room_id=eq.${roomId}` }, (payload) => {
        const e = payload.new as unknown as { id: string; kind: string; message: string; created_at: string };
        setEvents((es) => [...es, { id: e.id, kind: e.kind, message: e.message, created_at: e.created_at }]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arena_match_results', filter: `room_id=eq.${roomId}` }, () => {
        navigate(`/games/avalanche-arena/results?room=${roomId}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, navigate]);

  const log = useCallback(async (kind: string, message: string, payload?: Record<string, unknown>) => {
    if (!roomId || !me) return;
    await supabase.from('arena_room_events').insert({ room_id: roomId, player_id: me.id, kind, message, payload: (payload ?? {}) as unknown as Json });
  }, [roomId, me]);

  // ── Host actions ─────────────────────────────────────────────────
  async function startMatch() {
    if (!room || !isHost) return;
    const ready = players.filter((p) => p.is_ready);
    if (ready.length < 1) { toast.error('At least 1 ready player required'); return; }
    const first = [...players].sort((a, b) => a.seat - b.seat)[0];
    await supabase.from('arena_rooms').update({
      status: 'playing',
      current_round: 1,
      current_player_id: first.id,
      actions_remaining: room.actions_per_turn,
      turn_started_at: new Date().toISOString(),
    }).eq('id', room.id);
    await supabase.from('arena_room_events').insert({
      room_id: room.id, player_id: first.id, kind: 'match_start',
      message: `🚀 Match started · ${getMode(room.mode).title} · ${first.nickname} goes first`,
    });
  }

  async function toggleReady() {
    if (!me) return;
    await supabase.from('arena_room_players').update({ is_ready: !me.is_ready }).eq('id', me.id);
  }

  // ── Player actions (Pass 1: Mine + End Turn) ─────────────────────
  async function spendAction(updatesForMe: Partial<PlayerRow>, kind: string, message: string) {
    if (!room || !me || !isMyTurn || room.actions_remaining <= 0) return;
    await supabase.from('arena_room_players').update(updatesForMe as unknown as Record<string, unknown>).eq('id', me.id);
    await supabase.from('arena_room_events').insert({ room_id: room.id, player_id: me.id, kind, message });
    const remaining = room.actions_remaining - 1;
    if (remaining <= 0) {
      await advanceTurn();
    } else {
      await supabase.from('arena_rooms').update({ actions_remaining: remaining }).eq('id', room.id);
    }
  }

  async function advanceTurn() {
    if (!room) return;
    const sorted = [...players].sort((a, b) => a.seat - b.seat);
    const idx = sorted.findIndex((p) => p.id === room.current_player_id);
    const next = sorted[(idx + 1) % sorted.length];
    const isNewRound = (idx + 1) >= sorted.length;
    const newRound = isNewRound ? room.current_round + 1 : room.current_round;
    if (newRound > room.max_rounds) {
      await endMatch();
      return;
    }
    await supabase.from('arena_rooms').update({
      current_player_id: next.id,
      actions_remaining: room.actions_per_turn,
      turn_started_at: new Date().toISOString(),
      current_round: newRound,
    }).eq('id', room.id);
    if (isNewRound) {
      await supabase.from('arena_room_events').insert({ room_id: room.id, player_id: next.id, kind: 'round', message: `🔄 Round ${newRound} · ${next.nickname}'s turn` });
    }
  }

  async function endTurn() {
    if (!room || !isMyTurn) return;
    await advanceTurn();
  }

  async function actionMine() {
    if (!me) return;
    await spendAction(
      { arena_tokens: me.arena_tokens + 25, energy: Math.max(0, me.energy - 5), score: me.score + 10, xp_earned: me.xp_earned + 10 },
      'mine', `⛏️ ${me.nickname} mined +25 ARENA`,
    );
    setLearning({ open: true, title: 'Mining tokens', body: 'In Avalanche L1s, the NativeMinter precompile lets you mint native tokens with custom rules — perfect for in-game economies.' });
  }

  async function actionDefend() {
    if (!me) return;
    await spendAction(
      { validators: me.validators + 1, chain_health: Math.min(100, me.chain_health + 10), score: me.score + 5, xp_earned: me.xp_earned + 5 },
      'defend', `🛡️ ${me.nickname} reinforced their validators (+1)`,
    );
    setLearning({ open: true, title: 'Validators', body: 'Validators secure Avalanche L1s by participating in consensus and maintaining network integrity.' });
  }

  async function actionClaim() {
    if (!me || !room || !selectedTile) { toast.error('Select an empty tile first'); return; }
    const tile = room.board.find((t) => t.r === selectedTile.r && t.c === selectedTile.c);
    if (!tile) return;
    if (tile.ownerPlayerId) { toast.error('Tile already owned — use Attack'); return; }
    const board = room.board.map((t) => t.r === tile.r && t.c === tile.c ? { ...t, ownerPlayerId: me.id, health: 50 } : t);
    await supabase.from('arena_rooms').update({ board: board as unknown as Json }).eq('id', room.id);
    await spendAction(
      { territories: me.territories + 1, score: me.score + 20, xp_earned: me.xp_earned + 15 },
      'claim', `🗺️ ${me.nickname} claimed (${tile.r},${tile.c})`,
    );
    setSelectedTile(null);
  }

  async function endMatch() {
    if (!room) return;
    // Standings + record
    const { computeStandings, recordMatchResult } = await import('@/lib/web3/arenaRewards');
    const standings = computeStandings(
      players.map((p) => ({ id: p.id, user_id: p.user_id, nickname: p.nickname, score: p.score, territories: p.territories, chain_health: p.chain_health })),
      Object.fromEntries(players.map((p) => [p.id, null])),
    );
    const concepts = Array.from(new Set(events.filter((e) => ['mine', 'defend', 'claim'].includes(e.kind)).map((e) => e.kind)));
    await recordMatchResult(room.id, room.mode, standings, concepts);
    await supabase.from('arena_rooms').update({ status: 'finished' }).eq('id', room.id);
  }

  if (!roomId) return <div className="p-8">Missing room</div>;
  if (!room) return <div className="p-8 text-muted-foreground">Loading room…</div>;

  const modeMeta = getMode(room.mode);
  const tilesArr: Tile[] = Array.isArray(room.board) ? room.board : [];

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">{modeMeta.emoji} {modeMeta.title}{room.event_mode ? ' · Event Mode' : ''}</div>
            <h1 className="font-display text-xl tracking-wider">Room {room.code}</h1>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(room.code); toast.success('Copied'); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" /> Share code
          </button>
        </header>

        {/* Lobby state */}
        {room.status === 'lobby' && (
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display tracking-wider text-sm">Lobby · {players.length}/{room.max_players} players</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md border border-border bg-background p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: p.chain_color }} />
                    <span className="text-sm">{p.emoji} {p.nickname}</span>
                    {p.id === myPlayerId && <span className="text-[10px] text-muted-foreground">(you)</span>}
                  </div>
                  <span className={`text-[10px] ${p.is_ready ? 'text-primary' : 'text-muted-foreground'}`}>{p.is_ready ? 'READY' : 'waiting'}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={toggleReady} variant={me?.is_ready ? 'outline' : 'default'}>{me?.is_ready ? 'Unready' : 'Ready up'}</Button>
              {isHost && <Button onClick={startMatch} className="gap-2"><Play className="h-4 w-4" /> Start match</Button>}
            </div>
          </section>
        )}

        {/* Playing state */}
        {room.status === 'playing' && (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <TurnPanel
                currentNickname={players.find((p) => p.id === room.current_player_id)?.nickname ?? null}
                isMyTurn={isMyTurn}
                round={room.current_round}
                maxRounds={room.max_rounds}
                actionsRemaining={room.actions_remaining}
                turnStartedAt={room.turn_started_at}
                turnSeconds={room.turn_seconds}
                onEndTurn={endTurn}
              />
              <ChainMap
                tiles={tilesArr}
                playerColors={playerColors}
                selectedTile={selectedTile}
                onTileClick={(t) => setSelectedTile({ r: t.r, c: t.c })}
              />
              <BattleLog entries={events.slice(-30)} />
            </div>

            <aside className="space-y-4">
              {me && (
                <ResourceDashboard
                  arena={me.arena_tokens} energy={me.energy} validators={me.validators}
                  chainHealth={me.chain_health} territories={me.territories}
                  warriors={me.warriors?.length ?? 0} xp={me.xp_earned}
                />
              )}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="font-display text-xs tracking-wider">Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={actionMine} disabled={!isMyTurn}>⛏️ Mine</Button>
                  <Button size="sm" variant="outline" onClick={actionDefend} disabled={!isMyTurn}>🛡️ Defend</Button>
                  <Button size="sm" variant="outline" onClick={actionClaim} disabled={!isMyTurn || !selectedTile} className="col-span-2">🗺️ Claim selected tile</Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Pass 2 will add Attack, Bridge, Upgrade, and the battle resolver.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-display text-xs tracking-wider">Your warriors</div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(me?.warriors ?? []).map((w) => (
                    <WarriorCard key={w.tokenId} w={w} selected={selectedWarrior === w.tokenId} onClick={() => setSelectedWarrior(w.tokenId)} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-display text-xs tracking-wider">Standings</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums">#{i + 1}</span>
                        <span className="h-2 w-2 rounded-full" style={{ background: p.chain_color }} />
                        {p.nickname}
                      </span>
                      <span className="font-mono">{p.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {isHost && (
                <Button variant="outline" size="sm" onClick={endMatch} className="w-full">End match now</Button>
              )}
            </aside>
          </div>
        )}

        {room.status === 'finished' && (
          <div className="mt-10 text-center">
            <div className="text-5xl">🏆</div>
            <h2 className="mt-3 font-display text-2xl tracking-wider">Match complete</h2>
            <Button className="mt-4" onClick={() => navigate(`/games/avalanche-arena/results?room=${room.id}`)}>View results</Button>
          </div>
        )}

        <LearningModal open={learning.open} onOpenChange={(o) => setLearning((l) => ({ ...l, open: o }))} title={learning.title} body={learning.body} />
      </main>
    </div>
  );
}

// avoid unused
void BOARD_ROWS; void BOARD_COLS;