import { useEffect, useState } from 'react';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { JourneyMeter } from '@/components/avalanche/JourneyMeter';
import { NFTBadgeCard } from '@/components/avalanche/NFTBadgeCard';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/lib/playerContext';
import { PERSONAS, JourneyStage, dbRowToGame, AvalancheGame } from '@/lib/avalanche';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Calendar, Flame, Sparkles, Target } from 'lucide-react';

export default function MyJourneyPage() {
  const { user, profile, nfts } = usePlayer();
  const [personaGames, setPersonaGames] = useState<AvalancheGame[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase.from('games').select('*').eq('persona', profile.persona).eq('status', 'live').limit(6)
      .then(({ data }) => { if (data) setPersonaGames(data.map(dbRowToGame)); });
  }, [profile?.persona]);

  if (!user || !profile) {
    return (
      <div className="min-h-screen">
        <AppNavbar />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-display text-2xl tracking-wider">Start your journey</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in once, your identity travels with you across every event.</p>
          <Button asChild className="mt-6"><Link to="/auth">Sign in</Link></Button>
        </div>
      </div>
    );
  }

  const persona = PERSONAS.find(p => p.id === profile.persona)!;
  const stage = (profile.stage.charAt(0).toUpperCase() + profile.stage.slice(1)) as JourneyStage;

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-3xl">{profile.emoji}</div>
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{persona.emoji} {persona.label}</span>
                {profile.status_tag && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">{profile.status_tag}</span>}
              </div>
              <h1 className="mt-2 font-display text-3xl tracking-wider">{profile.username}'s Journey</h1>
              <p className="mt-1 text-sm text-muted-foreground">Every event remembered. Every mission matters.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <JourneyMeter xp={profile.xp} stage={stage} />
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<Sparkles className="h-3.5 w-3.5 text-primary" />} label="Level" value={profile.level} />
            <MiniStat icon={<Flame className="h-3.5 w-3.5 text-primary" />} label="Streak" value={profile.streak} />
            <MiniStat icon={<Target className="h-3.5 w-3.5 text-primary" />} label="NFTs" value={nfts.length} />
            <MiniStat icon={<Calendar className="h-3.5 w-3.5 text-primary" />} label="Stage" value={stage} />
          </div>
        </div>

        <div className="space-y-8 lg:col-span-2">
          <Section title="NFT badges earned" empty="No NFT badges yet — finish a mission tagged 'NFT'.">
            {nfts.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {nfts.map(n => (
                  <NFTBadgeCard
                    key={n.id}
                    nft={{
                      id: n.id, title: n.title, eventId: n.event_id || '',
                      eventName: '—', date: new Date(n.minted_at).toLocaleDateString(),
                      achievement: 'Mission complete', emoji: n.emoji,
                      rarity: (n.rarity.charAt(0).toUpperCase() + n.rarity.slice(1)) as 'Common' | 'Rare' | 'Legendary',
                      mintedAt: new Date(n.minted_at).getTime(),
                    }}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Up next for you" empty="You've cleared everything for your persona — pick a new one in Profile.">
            {personaGames.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {personaGames.map(g => (
                  <Link key={g.id} to={`/play/${g.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40">
                    <span className="text-2xl">{g.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm tracking-wider">{g.title}</div>
                      <div className="text-[10px] text-muted-foreground">+{g.xpReward} XP · {g.duration}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-display text-xl">{value}</div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-lg tracking-wider">{title}</h2>
      <div className="mt-3">
        {children || <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}

