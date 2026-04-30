import { useEffect, useState } from 'react';
import { AppNavbar } from '@/components/avalanche/AppNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePlayer } from '@/lib/playerContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, Sparkles, Loader2 } from 'lucide-react';

interface Quest {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
  evidence_kind: string;
  placeholder: string;
  xp_reward: number;
  sort_order: number;
  is_active: boolean;
}

interface Submission {
  id: string;
  quest_id: string;
  evidence: string;
  status: 'pending' | 'approved' | 'rejected';
  xp_awarded: number;
  rejection_reason?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  social: 'Social',
  community: 'Community',
  wallet: 'Wallet',
  builders_hub: 'Builders Hub',
  gaming: '🎮 Gaming on Avalanche',
};

export default function QuestsPage() {
  const { user, profile, refreshProfile } = usePlayer();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, Submission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('quests')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setQuests(data as Quest[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('quest_submissions')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const map = new Map<string, Submission>();
          (data as Submission[]).forEach(s => map.set(s.quest_id, s));
          setSubmissions(map);
        }
      });
  }, [user]);

  async function handleSubmit(quest: Quest) {
    if (!user) return;
    const ev = evidence[quest.id]?.trim();
    if (!ev) {
      setErrors(e => ({ ...e, [quest.id]: 'Please enter your evidence' }));
      return;
    }
    setErrors(e => ({ ...e, [quest.id]: '' }));
    setSubmitting(s => ({ ...s, [quest.id]: true }));

    try {
      const token = localStorage.getItem('ppa_token');
      const res = await fetch('/api/quests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quest_id: quest.id, evidence: ev }),
      });
      const data = await res.json();
      if (data.error) {
        setErrors(e => ({ ...e, [quest.id]: data.error }));
      } else {
        setSubmissions(m => {
          const next = new Map(m);
          next.set(quest.id, data.data as Submission);
          return next;
        });
        setEvidence(ev2 => ({ ...ev2, [quest.id]: '' }));
        refreshProfile();
      }
    } catch {
      setErrors(e => ({ ...e, [quest.id]: 'Network error — try again' }));
    } finally {
      setSubmitting(s => ({ ...s, [quest.id]: false }));
    }
  }

  const completedCount = submissions.size;
  const totalXp = Array.from(submissions.values())
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + s.xp_awarded, 0);

  return (
    <div className="min-h-screen">
      <AppNavbar />

      <div className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-3xl tracking-wider">Quests</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete tasks to earn XP and unlock your path in the Avalanche ecosystem.
              </p>
            </div>
            {user && (
              <div className="flex gap-4 text-sm">
                <div className="rounded-lg border border-border px-4 py-2 text-center">
                  <div className="font-display text-xl tracking-wider">{completedCount}/{quests.length}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="rounded-lg border border-border px-4 py-2 text-center">
                  <div className="font-display text-xl tracking-wider text-primary">+{totalXp}</div>
                  <div className="text-xs text-muted-foreground">XP earned</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {!user && (
          <div className="mb-8 rounded-lg border border-border bg-muted/30 px-6 py-5 text-center">
            <p className="text-sm text-muted-foreground">Sign in to track your progress and earn XP.</p>
            <Button asChild size="sm" className="mt-3"><Link to="/auth">Sign in</Link></Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading quests…
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              quests.reduce((acc, q) => {
                (acc[q.category] = acc[q.category] || []).push(q);
                return acc;
              }, {} as Record<string, Quest[]>)
            ).map(([cat, catQuests]) => (
              <div key={cat}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                <div className="space-y-3">
                  {catQuests.map(quest => {
                    const sub = submissions.get(quest.id);
                    const done = sub?.status === 'approved';
                    const pending = sub?.status === 'pending';
                    const rejected = sub?.status === 'rejected';

                    return (
                      <div
                        key={quest.id}
                        className={`rounded-xl border p-5 transition-colors ${done ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                            {quest.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm">{quest.title}</h3>
                              {done && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                              {pending && <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                              {rejected && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{quest.description}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] py-0">
                                <Sparkles className="mr-1 h-2.5 w-2.5 text-primary" />
                                +{quest.xp_reward} XP
                              </Badge>
                              {done && (
                                <span className="text-[11px] text-primary font-medium">Completed ✓</span>
                              )}
                              {pending && (
                                <span className="text-[11px] text-yellow-600">Under review</span>
                              )}
                              {rejected && (
                                <span className="text-[11px] text-destructive">
                                  Rejected{sub.rejection_reason ? `: ${sub.rejection_reason}` : ''}
                                </span>
                              )}
                            </div>

                            {user && !done && !pending && (
                              <div className="mt-3 flex gap-2">
                                <Input
                                  className="h-8 text-xs flex-1"
                                  placeholder={quest.placeholder}
                                  value={evidence[quest.id] ?? ''}
                                  onChange={e => setEvidence(ev => ({ ...ev, [quest.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(quest); }}
                                  disabled={submitting[quest.id]}
                                />
                                <Button
                                  size="sm"
                                  className="h-8 shrink-0"
                                  onClick={() => handleSubmit(quest)}
                                  disabled={submitting[quest.id]}
                                >
                                  {submitting[quest.id] ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : 'Submit'}
                                </Button>
                              </div>
                            )}
                            {errors[quest.id] && (
                              <p className="mt-1 text-[11px] text-destructive">{errors[quest.id]}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
