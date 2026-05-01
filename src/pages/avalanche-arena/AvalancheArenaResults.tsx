import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getMode } from '@/lib/arena/modes';
import type { FinalStanding } from '@/lib/web3/arenaRewards';
import { Trophy, RotateCw, Library } from 'lucide-react';

interface ResultRow {
  id: string; mode: string; winner_nickname: string | null;
  standings: FinalStanding[]; concepts: string[]; arena_distributed: number;
  created_at: string;
}

export default function AvalancheArenaResults() {
  const [params] = useSearchParams();
  const roomId = params.get('room');
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultRow | null>(null);

  useEffect(() => {
    if (!roomId) return;
    supabase.from('arena_match_results').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setResult(data as unknown as ResultRow); });
  }, [roomId]);

  if (!roomId) return <div className="p-8">Missing room</div>;
  if (!result) return <div className="p-8 text-muted-foreground">Loading results…</div>;

  const mode = getMode(result.mode);
  const standings = result.standings ?? [];

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-3 font-display text-3xl tracking-wider">{result.winner_nickname ?? '—'} wins!</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode.emoji} {mode.title}</p>
        </div>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-sm tracking-wider">Final standings</h2>
          <ul className="mt-3 space-y-2">
            {standings.map((s) => (
              <li key={s.playerId} className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
                <span className="flex items-center gap-3">
                  <span className="font-display text-lg tracking-wider">#{s.rank}</span>
                  <span>{s.nickname}</span>
                </span>
                <span className="flex items-center gap-4 text-xs">
                  <span>Score <span className="font-mono">{s.score}</span></span>
                  <span className="text-primary">+{s.arenaEarned} ARENA</span>
                  <span className="text-muted-foreground">+{s.xpEarned} XP</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-sm tracking-wider">Avalanche concepts learned</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(mode.teaches).map((t) => (
              <span key={t} className="rounded-full border border-border px-2.5 py-1 text-xs">{t}</span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Total ARENA distributed (mock): {result.arena_distributed}</p>
        </section>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate('/games/avalanche-arena/lobby')} className="gap-2"><RotateCw className="h-4 w-4" /> Play again</Button>
          <Button variant="outline" onClick={() => navigate('/library')} className="gap-2"><Library className="h-4 w-4" /> Back to Game Library</Button>
        </div>
      </main>
    </div>
  );
}