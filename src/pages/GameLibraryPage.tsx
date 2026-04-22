import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { GameCard } from '@/components/avalanche/GameCard';
import { ChallengeCard } from '@/components/avalanche/ChallengeCard';
import { PersonaSelector } from '@/components/avalanche/PersonaSelector';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PERSONAS, Persona, GameCategory, Difficulty, AvalancheGame, dbRowToGame } from '@/lib/avalanche';
import { AvalancheChallenge, ChallengeTier, dbRowToChallenge } from '@/lib/challenges';
import { Search, Sparkles, Zap, Gamepad2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/lib/playerContext';

const CATEGORIES: ('All' | GameCategory)[] = ['All','Quiz','Simulation','Puzzle','Build Challenge','Team Challenge','Trivia','Mission Quest','Case Study','Decision Game','Leaderboard Challenge'];
const DIFFICULTIES: ('All' | Difficulty)[] = ['All','Beginner','Intermediate','Advanced'];
const TIERS: ('All' | ChallengeTier)[] = ['All','Beginner','Intermediate','Advanced'];

export default function GameLibraryPage() {
  const navigate = useNavigate();
  const { user } = usePlayer();
  const [params, setParams] = useSearchParams();
  const initialPersona = params.get('persona') as Persona | null;
  const initialTab = (params.get('tab') as 'speedrun' | 'quick' | 'arena') ?? 'speedrun';

  const [tab, setTab] = useState<'speedrun' | 'quick' | 'arena'>(initialTab);
  const [persona, setPersona] = useState<Persona | null>(initialPersona);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('All');
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>('All');
  const [tier, setTier] = useState<typeof TIERS[number]>('All');

  const [games, setGames] = useState<AvalancheGame[]>([]);
  const [challenges, setChallenges] = useState<AvalancheChallenge[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set());
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  useEffect(() => {
    supabase.from('games').select('*').order('persona').order('xp_reward')
      .then(({ data }) => {
        if (data) setGames(data.map(dbRowToGame));
        setLoadingGames(false);
      });
    supabase.from('challenges').select('*').order('xp_reward')
      .then(({ data }) => {
        if (data) setChallenges(data.map(dbRowToChallenge));
        setLoadingChallenges(false);
      });
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    setParams(next, { replace: true });
  }, [tab]);

  useEffect(() => {
    if (!user) return;
    supabase.from('challenge_submissions').select('challenge_id,status')
      .eq('user_id', user.id).eq('status', 'verified')
      .then(({ data }) => { if (data) setCompletedChallenges(new Set(data.map((r: { challenge_id: string }) => r.challenge_id))); });
  }, [user]);

  const filteredChallenges = useMemo(() => challenges.filter(c => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || c.title.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q);
    const matchT = tier === 'All' || c.tier === tier;
    return matchQ && matchT;
  }), [challenges, query, tier]);

  const filteredGames = useMemo(() => games.filter(g => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
    const matchP = !persona || g.persona === persona;
    const matchC = category === 'All' || g.category === category;
    const matchD = difficulty === 'All' || g.difficulty === difficulty;
    return matchQ && matchP && matchC && matchD;
  }), [games, persona, query, category, difficulty]);

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="font-display text-3xl tracking-wider sm:text-4xl">Mission Library</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Build → Submit → Prove → Earn. Speedrun-style Avalanche challenges with on-chain verification, plus quick missions for warm-ups.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'speedrun' | 'quick' | 'arena')}>
          <TabsList className="bg-card flex-wrap">
            <TabsTrigger value="speedrun" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Speedrun Challenges
              <span className="ml-1 rounded-full bg-foreground/15 px-1.5 py-0.5 text-[10px]">{challenges.length}</span>
            </TabsTrigger>
            <TabsTrigger value="quick" className="gap-2">
              <Zap className="h-3.5 w-3.5" /> Quick Missions
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{games.length}</span>
            </TabsTrigger>
            <TabsTrigger value="arena" className="gap-2 data-[state=active]:bg-[hsl(var(--team-blue))] data-[state=active]:text-white">
              <Gamepad2 className="h-3.5 w-3.5" /> AvaUSD Arena 🎮
            </TabsTrigger>
          </TabsList>

          {/* SPEEDRUN */}
          <TabsContent value="speedrun" className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search challenges…" className="pl-9" />
              </div>
              <Select label="Tier" options={TIERS} value={tier} onChange={(v) => setTier(v as typeof tier)} />
              <div className="text-xs text-muted-foreground ml-auto">{filteredChallenges.length} {filteredChallenges.length === 1 ? 'challenge' : 'challenges'}</div>
            </div>
            {loadingChallenges ? (
              <div className="mt-12 text-center text-sm text-muted-foreground">Loading challenges…</div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredChallenges.map(c => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    completed={completedChallenges.has(c.id)}
                    onOpen={() => navigate(`/challenge/${c.slug}`)}
                  />
                ))}
              </div>
            )}
            {!loadingChallenges && filteredChallenges.length === 0 && <div className="mt-12 text-center text-sm text-muted-foreground">No challenges match those filters.</div>}
          </TabsContent>

          {/* QUICK MISSIONS */}
          <TabsContent value="quick" className="mt-6">
            <div>
              <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">By persona</div>
              <PersonaSelector selected={persona} onSelect={(p) => setPersona(p === persona ? null : p)} layout="pills" showAll />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search missions…" className="pl-9" />
              </div>
              <Select label="Category" options={CATEGORIES} value={category} onChange={(v) => setCategory(v as typeof category)} />
              <Select label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={(v) => setDifficulty(v as typeof difficulty)} />
              <div className="text-xs text-muted-foreground ml-auto">{filteredGames.length} {filteredGames.length === 1 ? 'mission' : 'missions'}</div>
            </div>

            {loadingGames ? (
              <div className="mt-12 text-center text-sm text-muted-foreground">Loading missions…</div>
            ) : persona ? (
              <div className="mt-6">
                <PersonaHeader persona={persona} />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredGames.map(g => <GameCard key={g.id} game={g} onPlay={() => navigate(`/play/${g.id}`)} />)}
                </div>
              </div>
            ) : (
              PERSONAS.map(p => {
                const pGames = filteredGames.filter(g => g.persona === p.id);
                if (pGames.length === 0) return null;
                return (
                  <div key={p.id} className="mt-8">
                    <PersonaHeader persona={p.id} />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {pGames.map(g => <GameCard key={g.id} game={g} onPlay={() => navigate(`/play/${g.id}`)} />)}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* ARENA */}
          <TabsContent value="arena" className="mt-6">
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="text-7xl">🏟️</div>
              <h2 className="font-display text-2xl tracking-wider">AvaUSD Arena</h2>
              <p className="text-sm text-muted-foreground max-w-md text-center">
                Real-time multiplayer quiz. Host a session, share the QR code, and battle your knowledge of Avalanche and stablecoins. Top scorer wins an NFT badge!
              </p>
              <div className="flex gap-3">
                <button onClick={() => navigate('/arena')} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-sm tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Sparkles className="h-4 w-4" /> Host a Game
                </button>
                <button onClick={() => navigate('/arena/join')} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 font-display text-sm tracking-wider hover:bg-muted transition-colors">
                  <Gamepad2 className="h-4 w-4" /> Join a Game
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PersonaHeader({ persona }: { persona: Persona }) {
  const p = PERSONAS.find(x => x.id === persona)!;
  return (
    <div className="flex items-center gap-3 border-b border-border pb-3">
      <span className="text-2xl">{p.emoji}</span>
      <div>
        <h2 className="font-display text-lg tracking-wider">{p.label}</h2>
        <p className="text-xs text-muted-foreground">{p.tagline}</p>
      </div>
    </div>
  );
}

function Select<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
