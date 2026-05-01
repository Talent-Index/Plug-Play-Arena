import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ModeSelector } from '@/components/arena/ModeSelector';
import { ArenaMode, CHAIN_COLORS, CHAIN_NAMES, generateRoomCode, MODES, emptyBoard, BOARD_COLS, BOARD_ROWS, Tile } from '@/lib/arena/modes';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/lib/playerContext';
import { toast } from 'sonner';
import { connectArenaWallet, loadStoredWallet, shortAddr } from '@/lib/web3/mockWallet';
import { mintStarterWarriors } from '@/lib/web3/mockContracts';
import { Wallet, Plus, LogIn } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

export default function AvalancheArenaLobby() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = usePlayer();
  const [mode, setMode] = useState<ArenaMode>(((params.get('mode') as ArenaMode) ?? 'chain_builder'));
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [eventMode, setEventMode] = useState(false);
  const [wallet, setWallet] = useState(loadStoredWallet());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nickname && user?.user_metadata?.username) setNickname(user.user_metadata.username as string);
  }, [user, nickname]);

  const turnSeconds = eventMode ? 20 : 30;
  const maxRounds = eventMode ? 6 : 10;

  async function ensureWallet() {
    if (wallet) return wallet;
    const w = await connectArenaWallet({ allowMock: true });
    setWallet(w);
    return w;
  }

  async function createRoom() {
    if (!user) { toast.error('Please sign in first'); navigate('/auth'); return; }
    if (!nickname.trim()) { toast.error('Pick a nickname'); return; }
    setBusy(true);
    try {
      const w = await ensureWallet();
      const code = generateRoomCode();
      const board = seedBoard(0);
      const { data: room, error } = await supabase.from('arena_rooms').insert({
        code,
        host_user_id: user.id,
        mode,
        max_players: 4,
        event_mode: eventMode,
        turn_seconds: turnSeconds,
        actions_per_turn: 2,
        max_rounds: maxRounds,
        actions_remaining: 2,
        board: board as unknown as Json,
      }).select().single();
      if (error || !room) throw error ?? new Error('Failed to create room');

      const warriors = mintStarterWarriors(user.id);
      const { data: player, error: pErr } = await supabase.from('arena_room_players').insert({
        room_id: room.id,
        user_id: user.id,
        nickname: nickname.trim(),
        emoji: '🔺',
        chain_color: CHAIN_COLORS[0],
        seat: 0,
        is_ready: true,
        warriors: warriors as unknown as Json,
      }).select().single();
      if (pErr || !player) throw pErr ?? new Error('Failed to add player');

      // Save wallet on the player row (separate column doesn't exist; use payload event)
      await supabase.from('arena_room_events').insert({
        room_id: room.id,
        player_id: player.id,
        kind: 'wallet_attached',
        message: `${nickname.trim()} connected ${shortAddr(w.address)}${w.isMock ? ' (mock)' : ''}`,
        payload: { address: w.address, mock: w.isMock } as unknown as Json,
      });

      navigate(`/games/avalanche-arena/play?room=${room.id}&player=${player.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    if (!user) { toast.error('Please sign in first'); navigate('/auth'); return; }
    if (!nickname.trim()) { toast.error('Pick a nickname'); return; }
    if (!joinCode.trim()) { toast.error('Enter a room code'); return; }
    setBusy(true);
    try {
      await ensureWallet();
      const { data: room } = await supabase.from('arena_rooms').select('*').eq('code', joinCode.trim().toUpperCase()).maybeSingle();
      if (!room) throw new Error('Room not found');
      if (room.status !== 'lobby') throw new Error('Game already started');
      const { data: existing } = await supabase.from('arena_room_players').select('seat').eq('room_id', room.id);
      const seats = new Set((existing ?? []).map((p) => p.seat));
      let seat = 0;
      while (seats.has(seat) && seat < room.max_players) seat++;
      if (seat >= room.max_players) throw new Error('Room is full');
      const warriors = mintStarterWarriors(user.id);
      const { data: player, error } = await supabase.from('arena_room_players').insert({
        room_id: room.id,
        user_id: user.id,
        nickname: nickname.trim(),
        emoji: '🔺',
        chain_color: CHAIN_COLORS[seat] ?? CHAIN_COLORS[0],
        seat,
        is_ready: false,
        warriors: warriors as unknown as Json,
      }).select().single();
      if (error || !player) throw error ?? new Error('Could not join');
      navigate(`/games/avalanche-arena/play?room=${room.id}&player=${player.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  const modeMeta = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-2xl tracking-wider sm:text-3xl">AvalancheArena Lobby</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create a room and share the code, or join with a code.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-sm tracking-wider">1 · Mode</h2>
            <div className="mt-3"><ModeSelector value={mode} onChange={setMode} /></div>
          </section>

          <aside className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="font-display text-sm tracking-wider">2 · Identity</h2>
              <Label className="mt-3 block text-xs">Nickname</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ChainBuilder42" maxLength={20} />
              <Label className="mt-3 block text-xs">Wallet</Label>
              <div className="mt-1 flex items-center gap-2">
                {wallet ? (
                  <span className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">{shortAddr(wallet.address)}{wallet.isMock ? ' · mock' : ''}</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { setWallet(await connectArenaWallet({ allowMock: true })); } catch (e) { toast.error(String(e)); }
                  }} className="gap-2"><Wallet className="h-3.5 w-3.5" /> Connect</Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div>
                <div className="text-sm">Event Mode</div>
                <div className="text-[10px] text-muted-foreground">Shorter rounds, faster onboarding</div>
              </div>
              <Switch checked={eventMode} onCheckedChange={setEventMode} />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-sm tracking-wider">3 · Start</h2>
              <Button onClick={createRoom} disabled={busy} className="w-full gap-2"><Plus className="h-4 w-4" /> Create room</Button>
              <div className="flex items-center gap-2">
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} className="font-mono" />
                <Button onClick={joinRoom} disabled={busy} variant="outline" className="gap-2"><LogIn className="h-4 w-4" /> Join</Button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background/50 p-3 text-xs">
              <div className="font-display tracking-wider">{modeMeta.emoji} {modeMeta.title}</div>
              <div className="mt-1 text-muted-foreground">{modeMeta.tagline}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// Place 1 base tile per seat at the four corners of the 5x4 board.
function seedBoard(_seats: number): Tile[] {
  const board = emptyBoard();
  const corners: Array<[number, number]> = [
    [0, 0],
    [BOARD_ROWS - 1, BOARD_COLS - 1],
    [0, BOARD_COLS - 1],
    [BOARD_ROWS - 1, 0],
  ];
  for (let s = 0; s < 4; s++) {
    const [r, c] = corners[s];
    const tile = board.find((t) => t.r === r && t.c === c)!;
    tile.isBase = true;
    tile.health = 100;
  }
  return board;
}