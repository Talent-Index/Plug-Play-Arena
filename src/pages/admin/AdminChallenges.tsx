import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChallengeRow } from '@/integrations/supabase/extended-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

const TIERS = ['beginner','intermediate','advanced'];
const ACCENTS = ['blue','green','purple','orange','pink','yellow'];

const TIER_PILL: Record<string, string> = {
  beginner:     'bg-green-500/15 text-green-400',
  intermediate: 'bg-yellow-500/15 text-yellow-400',
  advanced:     'bg-red-500/15 text-red-400',
};

type FormData = {
  id: string; slug: string; title: string; tagline: string; emoji: string;
  accent: string; tier: string; ai_ready: string; est_minutes: string;
  xp_reward: string; badge_title: string; concept: string; brief: string;
  steps_json: string; build_prompt: string; ai_prompt: string;
  submission_json: string; verification_json: string;
};

const DEFAULT_STEPS = JSON.stringify([{ title: 'Step 1', detail: 'Do something', hint: 'Optional hint' }], null, 2);
const DEFAULT_SUB = JSON.stringify({ primary: { key: 'repo_url', label: 'Repo URL', kind: 'url', placeholder: 'https://github.com/...' }, extras: [] }, null, 2);
const DEFAULT_VER = JSON.stringify({ kind: 'manual', rules: ['Verify the submission'] }, null, 2);

const EMPTY: FormData = {
  id: '', slug: '', title: '', tagline: '', emoji: '⚡', accent: 'blue',
  tier: 'beginner', ai_ready: 'false', est_minutes: '30', xp_reward: '200',
  badge_title: '', concept: '', brief: '', steps_json: DEFAULT_STEPS,
  build_prompt: '', ai_prompt: '', submission_json: DEFAULT_SUB, verification_json: DEFAULT_VER,
};

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [filtered, setFiltered] = useState<ChallengeRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChallengeRow | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  function fetch() {
    setLoading(true);
    supabase.from('challenges').select('*').order('xp_reward')
      .then(({ data }) => {
        if (data) {
          const rows = data as unknown as ChallengeRow[];
          setChallenges(rows); setFiltered(rows);
        }
        setLoading(false);
      });
  }
  useEffect(fetch, []);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(q ? challenges.filter(c => c.title.toLowerCase().includes(q) || c.slug.includes(q) || c.tier.includes(q)) : challenges);
  }, [query, challenges]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }

  function openEdit(c: ChallengeRow) {
    setEditing(c);
    setForm({
      id: c.id, slug: c.slug, title: c.title, tagline: c.tagline, emoji: c.emoji,
      accent: c.accent, tier: c.tier, ai_ready: String(c.ai_ready),
      est_minutes: String(c.est_minutes), xp_reward: String(c.xp_reward),
      badge_title: c.badge_title, concept: c.concept, brief: c.brief,
      steps_json: JSON.stringify(c.steps, null, 2),
      build_prompt: c.build_prompt, ai_prompt: c.ai_prompt ?? '',
      submission_json: JSON.stringify(c.submission, null, 2),
      verification_json: JSON.stringify(c.verification, null, 2),
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    let steps, submission, verification;
    try { steps = JSON.parse(form.steps_json); } catch { toast.error('Invalid steps JSON'); setSaving(false); return; }
    try { submission = JSON.parse(form.submission_json); } catch { toast.error('Invalid submission JSON'); setSaving(false); return; }
    try { verification = JSON.parse(form.verification_json); } catch { toast.error('Invalid verification JSON'); setSaving(false); return; }

    const payload = {
      id: form.id, slug: form.slug, title: form.title, tagline: form.tagline,
      emoji: form.emoji, accent: form.accent, tier: form.tier,
      ai_ready: form.ai_ready === 'true',
      est_minutes: parseInt(form.est_minutes) || 30,
      xp_reward: parseInt(form.xp_reward) || 200,
      badge_title: form.badge_title, concept: form.concept, brief: form.brief,
      steps, build_prompt: form.build_prompt,
      ai_prompt: form.ai_prompt || null,
      submission, verification,
    };

    const { error } = editing
      ? await supabase.from('challenges').update(payload).eq('id', editing.id)
      : await supabase.from('challenges').insert(payload);

    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Challenge updated.' : 'Challenge created.'); setOpen(false); fetch(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this challenge?')) return;
    const { error } = await supabase.from('challenges').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted.'); fetch(); }
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-wider">Challenges</h1>
          <p className="mt-1 text-sm text-muted-foreground">{challenges.length} speedrun challenges</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="pl-9 w-56" />
          </div>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Challenge</Button>
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 text-left">Challenge</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Est. Time</th>
                <th className="px-4 py-3 text-left">XP</th>
                <th className="px-4 py-3 text-left">AI Ready</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{c.emoji}</span>
                      <div>
                        <div className="font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TIER_PILL[c.tier] ?? ''}`}>{c.tier}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.est_minutes} min</td>
                  <td className="px-4 py-3 font-display text-sm text-primary">+{c.xp_reward}</td>
                  <td className="px-4 py-3 text-xs">{c.ai_ready ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">{editing ? 'Edit Challenge' : 'New Challenge'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <Row label="ID"><Input value={form.id} onChange={f('id')} placeholder="wallet-setup" /></Row>
                <Row label="Slug"><Input value={form.slug} onChange={f('slug')} placeholder="wallet-setup" /></Row>
              </div>
            )}
            <Row label="Title"><Input value={form.title} onChange={f('title')} /></Row>
            <Row label="Tagline"><Input value={form.tagline} onChange={f('tagline')} /></Row>
            <Row label="Concept"><Input value={form.concept} onChange={f('concept')} /></Row>
            <Row label="Brief"><Textarea value={form.brief} onChange={f('brief')} rows={2} /></Row>
            <div className="grid grid-cols-4 gap-3">
              <Row label="Emoji"><Input value={form.emoji} onChange={f('emoji')} /></Row>
              <Row label="Tier">
                <select value={form.tier} onChange={f('tier')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {TIERS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="Accent">
                <select value={form.accent} onChange={f('accent')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {ACCENTS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="AI Ready">
                <select value={form.ai_ready} onChange={f('ai_ready')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <option value="false">No</option><option value="true">Yes</option>
                </select>
              </Row>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Row label="Est. Minutes"><Input type="number" value={form.est_minutes} onChange={f('est_minutes')} /></Row>
              <Row label="XP Reward"><Input type="number" value={form.xp_reward} onChange={f('xp_reward')} /></Row>
              <Row label="Badge Title"><Input value={form.badge_title} onChange={f('badge_title')} /></Row>
            </div>
            <Row label="Steps JSON">
              <Textarea value={form.steps_json} onChange={f('steps_json')} rows={5} className="font-mono text-xs" />
            </Row>
            <Row label="Build Prompt"><Textarea value={form.build_prompt} onChange={f('build_prompt')} rows={3} /></Row>
            <Row label="AI Prompt (optional)"><Textarea value={form.ai_prompt} onChange={f('ai_prompt')} rows={2} /></Row>
            <Row label="Submission JSON">
              <Textarea value={form.submission_json} onChange={f('submission_json')} rows={4} className="font-mono text-xs" />
            </Row>
            <Row label="Verification JSON">
              <Textarea value={form.verification_json} onChange={f('verification_json')} rows={3} className="font-mono text-xs" />
            </Row>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save Challenge'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-muted-foreground">{label}</label>{children}</div>;
}
