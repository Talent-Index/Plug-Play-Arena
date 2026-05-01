import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Gamepad2, Sparkles, Wallet, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { PersonaSelector } from '@/components/avalanche/PersonaSelector';
import { GameCard } from '@/components/avalanche/GameCard';
import { EventCard } from '@/components/avalanche/EventCard';
import { AvalancheGame, AvalancheEvent, dbRowToGame, dbRowToEvent } from '@/lib/avalanche';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/lib/playerContext';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { user, profile } = usePlayer();
  const navigate = useNavigate();

  const [featuredMissions, setFeaturedMissions] = useState<AvalancheGame[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<AvalancheEvent[]>([]);
  const [counts, setCounts] = useState({ games: 0, events: 0 });

  useEffect(() => {
    supabase.from('games').select('*').eq('status', 'live').limit(3)
      .then(({ data }) => {
        if (data) setFeaturedMissions(data.map(dbRowToGame));
      });

    supabase.from('events').select('*').in('status', ['live', 'draft']).order('starts_at').limit(3)
      .then(({ data }) => {
        if (data) setFeaturedEvents(data.map(dbRowToEvent));
      });

    Promise.all([
      supabase.from('games').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
    ]).then(([g, e]) => setCounts({
      games: (g as unknown as { count: number | null }).count ?? 0,
      events: (e as unknown as { count: number | null }).count ?? 0,
    }));
  }, []);

  return (
    <div className="min-h-screen">
      <AppNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-muted-foreground">Avalanche ecosystem · onboarding & upskilling</span>
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              Build your Avalanche journey<br /><span className="text-primary">through play.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Learn, compete, and earn at live events and virtual sessions designed for students, developers, builders, founders, and businesses.
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every event remembered. Every mission matters. Every reward leaves a mark.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!user ? (
                <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="gap-2">
                  <Wallet className="h-4 w-4" /> Sign up & play
                </Button>
              ) : !profile?.persona ? (
                <Button size="lg" onClick={() => navigate('/onboarding')} className="gap-2">
                  Create identity <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => navigate('/events')} className="gap-2">
                  Join an event <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button size="lg" variant="secondary" asChild>
                <Link to="/quests">Complete quests</Link>
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat icon={<Calendar className="h-4 w-4" />} value={`${counts.events}`} label="Events" />
              <Stat icon={<Gamepad2 className="h-4 w-4" />} value={`${counts.games}`} label="Missions" />
              <Stat icon={<Users className="h-4 w-4" />} value="5" label="Personas" />
              <Stat icon={<Trophy className="h-4 w-4" />} value="$20K+" label="Reward pool" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Persona */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-wider">Pick your path</h2>
              <p className="mt-1 text-sm text-muted-foreground">Curated missions for every kind of builder.</p>
            </div>
          </div>
          <PersonaSelector
            selected={profile?.persona ?? null}
            onSelect={(persona) => navigate(`/library?persona=${persona}`)}
          />
        </div>
      </section>

      {/* Featured events */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionHeader
            title="Featured events"
            sub="IRL, Zoom, and hybrid sessions across Africa and online."
            ctaLabel="All events"
            ctaHref="/events"
          />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredEvents.length === 0 ? (
              <div className="col-span-3 text-sm text-muted-foreground py-8 text-center">No live events right now — check back soon.</div>
            ) : featuredEvents.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        </div>
      </section>

      {/* Featured missions */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionHeader
            title="Featured missions"
            sub="Bite-sized Avalanche learning, with rewards."
            ctaLabel="Game library"
            ctaHref="/library"
          />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredMissions.map(g => <GameCard key={g.id} game={g} onPlay={() => navigate(`/library?play=${g.id}`)} />)}
          </div>
        </div>
      </section>

      {/* Rewards */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="font-display text-2xl tracking-wider">Rewards that matter</h2>
          <p className="mt-1 text-sm text-muted-foreground">Real value: AVAX, merch, NFTs, and ecosystem perks.</p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RewardTease emoji="💰" title="AVAX" sub="Top performers per event" />
            <RewardTease emoji="🧥" title="Genesis Merch" sub="Hoodies, caps, stickers" />
            <RewardTease emoji="🪪" title="Participation NFTs" sub="On-chain proof of attendance" />
            <RewardTease emoji="🎟️" title="Founder perks" sub="Mentorship & private sessions" />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        Built for the <span className="text-primary">Avalanche</span> ecosystem · plug<span className="text-primary">n</span>play © 2026
      </footer>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-[11px] uppercase tracking-widest">{label}</span></div>
      <div className="mt-1 font-display text-2xl tracking-wider">{value}</div>
    </div>
  );
}

function SectionHeader({ title, sub, ctaLabel, ctaHref }: { title: string; sub: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl tracking-wider">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link to={ctaHref}>{ctaLabel} <ArrowRight className="h-3 w-3" /></Link>
      </Button>
    </div>
  );
}

function RewardTease({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-3xl">{emoji}</div>
      <div className="mt-3 font-display text-sm tracking-wider">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
