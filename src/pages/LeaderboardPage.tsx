import { useEffect, useState } from 'react';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { PersonaSelector } from '@/components/avalanche/PersonaSelector';
import { PERSONAS, Persona, JOURNEY_STAGES, getJourneyStage } from '@/lib/avalanche';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  emoji: string;
  persona: Persona;
  xp: number;
  level: number;
  stage: string;
  streak: number;
}

export default function LeaderboardPage() {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc('get_leaderboard', { _limit: 50, _persona: persona ?? undefined })
      .then(({ data, error }) => {
        if (!error && data) setEntries(data as LeaderboardEntry[]);
        setLoading(false);
      });
  }, [persona]);

  const filtered = entries;

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="font-display text-3xl tracking-wider sm:text-4xl">Leaderboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Top players across the Avalanche ecosystem.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month' | 'all')}>
            <TabsList>
              <TabsTrigger value="week">This week</TabsTrigger>
              <TabsTrigger value="month">This month</TabsTrigger>
              <TabsTrigger value="all">All time</TabsTrigger>
            </TabsList>
          </Tabs>
          <PersonaSelector selected={persona} onSelect={(p) => setPersona(p === persona ? null : p)} layout="pills" showAll />
        </div>

        {loading ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">Loading leaderboard…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">No players yet — be the first to play!</div>
        ) : (
          <>
            {/* Podium */}
            {filtered.length >= 3 && (
              <div className="mt-8 grid grid-cols-3 gap-3">
                {filtered.slice(0, 3).map((entry, idx) => {
                  const rank = idx + 1;
                  const heights = ['h-40','h-32','h-24'];
                  const order = [1, 0, 2];
                  return (
                    <div key={entry.user_id} className="flex flex-col items-center justify-end" style={{ order: order[idx] }}>
                      <div className="text-3xl">{entry.emoji}</div>
                      <div className="mt-2 font-display text-sm tracking-wider">{entry.username}</div>
                      <div className="text-[11px] text-muted-foreground">{entry.xp.toLocaleString()} XP</div>
                      <div className={`mt-2 w-full rounded-t-lg ${heights[idx]} flex items-start justify-center pt-2 ${
                        rank === 1 ? 'bg-primary/30 border border-primary/40' : rank === 2 ? 'bg-secondary/30 border border-secondary/40' : 'bg-muted'
                      }`}>
                        <span className="font-display text-xl">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table */}
            <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2">Persona</div>
                <div className="col-span-2">Stage</div>
                <div className="col-span-1 text-right">Streak</div>
                <div className="col-span-2 text-right">XP</div>
              </div>
              {filtered.map((e, i) => {
                const p = PERSONAS.find(x => x.id === e.persona);
                const stageObj = JOURNEY_STAGES.find(s => s.stage.toLowerCase() === e.stage?.toLowerCase());
                const stage = getJourneyStage(e.xp);
                return (
                  <div key={e.user_id} className="grid grid-cols-12 items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted/20">
                    <div className="col-span-1 font-display text-sm text-muted-foreground">{i + 1}</div>
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="text-lg">{e.emoji}</span>
                      <span className="font-medium truncate">{e.username}</span>
                    </div>
                    <div className="col-span-2 text-xs">{p ? `${p.emoji} ${p.label}` : e.persona}</div>
                    <div className="col-span-2 text-xs">{stageObj?.emoji ?? '🧭'} {stage}</div>
                    <div className="col-span-1 text-right text-xs">{e.streak}🔥</div>
                    <div className="col-span-2 text-right font-display text-sm text-primary">{e.xp.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
