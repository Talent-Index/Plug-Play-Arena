import { useNavigate } from 'react-router-dom';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { Button } from '@/components/ui/button';
import { ModeSelector } from '@/components/arena/ModeSelector';
import { useState } from 'react';
import { ArenaMode, MODES } from '@/lib/arena/modes';
import { Sparkles, Gamepad2, BookOpen } from 'lucide-react';

export default function AvalancheArenaIntro() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ArenaMode>('chain_builder');
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <header className="border-b border-border bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" /> Prototype · Live Multiplayer
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-wider sm:text-5xl">AvalancheArena: Chain Conquest</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Build your chain, deploy NFT warriors, defend validators, and conquer rival chains while learning Avalanche.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => navigate(`/games/avalanche-arena/lobby?mode=${mode}`)} className="gap-2">
              <Gamepad2 className="h-4 w-4" /> Play Game
            </Button>
            <Button variant="outline" onClick={() => setShowRules((s) => !s)} className="gap-2">
              <BookOpen className="h-4 w-4" /> View Rules
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="font-display text-lg tracking-wider">Pick a mode</h2>
        <p className="mt-1 text-xs text-muted-foreground">Each mode teaches a different Avalanche concept.</p>
        <div className="mt-4">
          <ModeSelector value={mode} onChange={setMode} />
        </div>

        {showRules && (
          <section className="mt-8 rounded-xl border border-border bg-card p-5">
            <h3 className="font-display tracking-wider">How it works</h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>2–4 players. Each turn lasts 30 seconds with 2 actions.</li>
              <li>5×4 territory grid. Claim, attack, defend, bridge, and upgrade tiles.</li>
              <li>Match ends after 10 rounds or when one player controls majority territory.</li>
              <li>Winner: 500 ARENA · Runner-up: 200 · Participation: 50 · Bonus XP for activity.</li>
              <li>Avalanche concept popups appear after key actions.</li>
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h3 className="font-display tracking-wider">Learn Avalanche concepts</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <div className="text-2xl">{m.emoji}</div>
                <div className="mt-1 font-display text-sm tracking-wider">{m.title}</div>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {m.teaches.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}