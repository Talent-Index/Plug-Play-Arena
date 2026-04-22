import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameRow } from '@/integrations/supabase/extended-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_PILL = { live: 'bg-green-500/15 text-green-400', soon: 'bg-yellow-500/15 text-yellow-400' };
const PERSONAS = ['student','developer','builder','founder','business'];
const CATEGORIES = ['Quiz','Simulation','Puzzle','Build Challenge','Team Challenge','Trivia','Mission Quest','Case Study','Decision Game','Leaderboard Challenge'];
const DIFFICULTIES = ['Beginner','Intermediate','Advanced'];
const REWARD_TYPES = ['xp','nft','merch','token'];

type FormData = {
  id: string; title: string; persona: string; category: string; difficulty: string;
  themes: string; description: string; learning_outcome: string; emoji: string;
  duration: string; xp_reward: string; reward_type: string; event_types: string; status: string;
};

const EMPTY: FormData = {
  id: '', title: '', persona: 'student', category: 'Quiz', difficulty: 'Beginner',
  themes: '', description: '', learning_outcome: '', emoji: '🎮', duration: '5 min',
  xp_reward: '100', reward_type: 'xp', event_types: 'IRL, Zoom, Hybrid', status: 'live',
};

export default function AdminGames() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [filtered, setFiltered] = useState<GameRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GameRow | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  function fetch() {
    setLoading(true);
    supabase.from('games').select('*').order('persona').order('xp_reward')
      .then(({ data }) => { if (data) { setGames(data); setFiltered(data); } setLoading(false); });
  }
  useEffect(fetch, []);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(q ? games.filter(g => g.title.toLowerCase().includes(q) || g.persona.includes(q) || g.category.toLowerCase().includes(q)) : games);
  }, [query, games]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }

  function openEdit(g: GameRow) {
    setEditing(g);
    setForm({ ...g, themes: g.themes.join(', '), event_types: g.event_types.join(', '), xp_reward: String(g.xp_reward) });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      id: form.id, title: form.title, persona: form.persona, category: form.category,
      difficulty: form.difficulty, description: form.description, learning_outcome: form.learning_outcome,
      emoji: form.emoji, duration: form.duration, xp_reward: parseInt(form.xp_reward) || 100,
      reward_type: form.reward_type, status: form.status,
      themes: form.themes.split(',').map(s => s.trim()).filter(Boolean),
      event_types: form.event_types.split(',').map(s => s.trim()).filter(Boolean),
    };

    const { error } = editing
      ? await supabase.from('games').update(payload).eq('id', editing.id)
      : await supabase.from('games').insert(payload);

    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Game updated.' : 'Game created.'); setOpen(false); fetch(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this game?')) return;
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted.'); fetch(); }
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-wider">Games</h1>
          <p className="mt-1 text-sm text-muted-foreground">{games.length} games in library</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="pl-9 w-56" />
          </div>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Game</Button>
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 text-left">Game</th>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">Difficulty</th>
                <th className="px-4 py-3 text-left">XP</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(g => (
                <tr key={g.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{g.emoji}</span>
                      <div>
                        <div className="font-medium">{g.title}</div>
                        <div className="text-xs text-muted-foreground">{g.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">{g.persona}</td>
                  <td className="px-4 py-3 text-xs">{g.difficulty}</td>
                  <td className="px-4 py-3 font-display text-sm text-primary">+{g.xp_reward}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[g.status as keyof typeof STATUS_PILL] ?? ''}`}>{g.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <DialogTitle className="font-display tracking-wider">{editing ? 'Edit Game' : 'New Game'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {!editing && <Row label="ID (slug)"><Input value={form.id} onChange={f('id')} placeholder="av-explorer-quiz" /></Row>}
            <Row label="Title"><Input value={form.title} onChange={f('title')} /></Row>
            <Row label="Description"><Textarea value={form.description} onChange={f('description')} rows={2} /></Row>
            <Row label="Learning Outcome"><Input value={form.learning_outcome} onChange={f('learning_outcome')} /></Row>
            <div className="grid grid-cols-3 gap-3">
              <Row label="Persona">
                <select value={form.persona} onChange={f('persona')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {PERSONAS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="Category">
                <select value={form.category} onChange={f('category')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {CATEGORIES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="Difficulty">
                <select value={form.difficulty} onChange={f('difficulty')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {DIFFICULTIES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Row label="Emoji"><Input value={form.emoji} onChange={f('emoji')} className="w-16" /></Row>
              <Row label="Duration"><Input value={form.duration} onChange={f('duration')} placeholder="5 min" /></Row>
              <Row label="XP Reward"><Input type="number" value={form.xp_reward} onChange={f('xp_reward')} /></Row>
              <Row label="Reward">
                <select value={form.reward_type} onChange={f('reward_type')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {REWARD_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
            </div>
            <Row label="Status">
              <select value={form.status} onChange={f('status')} className="w-40 rounded-md border border-border bg-card px-3 py-2 text-sm">
                <option value="live">live</option><option value="soon">soon</option>
              </select>
            </Row>
            <Row label="Themes (comma-separated)"><Input value={form.themes} onChange={f('themes')} placeholder="Avalanche Basics, Consensus" /></Row>
            <Row label="Event Types (comma-separated)"><Input value={form.event_types} onChange={f('event_types')} placeholder="IRL, Zoom, Hybrid" /></Row>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save Game'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-muted-foreground">{label}</label>{children}</div>;
}
