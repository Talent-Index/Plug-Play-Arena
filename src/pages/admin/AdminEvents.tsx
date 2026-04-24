import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EventRow } from '@/integrations/supabase/extended-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  live:  'bg-green-500/15 text-green-400 border-green-500/30',
  paused:'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  ended: 'bg-muted/50 text-muted-foreground',
};

type FormData = {
  title: string; description: string; format: string; location: string;
  category: string; zoom_url: string; difficulty: string; reward_pool: string;
  capacity: string; starts_at: string; ends_at: string; status: string;
  tracks: string; missions: string; agenda_json: string; cover_emoji: string;
};

const EMPTY: FormData = {
  title: '', description: '', format: 'irl', location: '', category: 'community',
  zoom_url: '', difficulty: 'beginner', reward_pool: '', capacity: '100',
  starts_at: '', ends_at: '', status: 'draft', tracks: '', missions: '',
  agenda_json: '[]', cover_emoji: '⚡',
};

export default function AdminEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  function fetchEvents() {
    setLoading(true);
    supabase.from('events').select('*').order('starts_at', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data as unknown as EventRow[]); setLoading(false); });
  }
  useEffect(fetchEvents, []);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }

  function openEdit(ev: EventRow) {
    setEditing(ev);
    setForm({
      title: ev.title, description: ev.description ?? '', format: ev.format,
      location: ev.location ?? '', category: ev.category ?? 'community',
      zoom_url: ev.zoom_url ?? '', difficulty: ev.difficulty ?? 'beginner',
      reward_pool: ev.reward_pool ?? '', capacity: String(ev.capacity ?? 100),
      starts_at: ev.starts_at ? ev.starts_at.slice(0, 16) : '',
      ends_at: ev.ends_at ? ev.ends_at.slice(0, 16) : '',
      status: ev.status, tracks: (ev.tracks ?? []).join(', '),
      missions: (ev.missions ?? []).join(', '),
      agenda_json: JSON.stringify(ev.agenda ?? [], null, 2),
      cover_emoji: ev.cover_emoji ?? '⚡',
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    let agenda = [];
    try { agenda = JSON.parse(form.agenda_json); } catch { toast.error('Invalid agenda JSON'); setSaving(false); return; }

    const payload = {
      title: form.title, description: form.description || null,
      format: form.format, location: form.location || null,
      category: form.category, zoom_url: form.zoom_url || null,
      difficulty: form.difficulty, reward_pool: form.reward_pool || null,
      capacity: parseInt(form.capacity) || 100,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      status: form.status as 'draft' | 'live' | 'paused' | 'ended',
      tracks: form.tracks ? form.tracks.split(',').map(s => s.trim()).filter(Boolean) : [],
      missions: form.missions ? form.missions.split(',').map(s => s.trim()).filter(Boolean) : [],
      agenda, cover_emoji: form.cover_emoji, is_platform_event: true,
    };

    const { error } = editing
      ? await supabase.from('events').update(payload as never).eq('id', editing.id)
      : await supabase.from('events').insert(payload as never);

    if (error) { toast.error(error.message); }
    else { toast.success(editing ? 'Event updated.' : 'Event created.'); setOpen(false); fetchEvents(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Event deleted.'); fetchEvents(); }
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('events').update({ status: status as 'draft' | 'live' | 'paused' | 'ended' }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Status → ${status}`); fetchEvents(); }
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-wider">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">{events.length} total events</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Event</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Format</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map(ev => (
                <tr key={ev.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{ev.cover_emoji}</span>
                      <div>
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">{ev.location || 'Virtual'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs">{ev.format}</td>
                  <td className="px-4 py-3">
                    <select
                      value={ev.status}
                      onChange={e => setStatus(ev.id, e.target.value)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium cursor-pointer bg-transparent ${STATUS_COLORS[ev.status] ?? ''}`}
                    >
                      {['draft','live','paused','ended'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ev.starts_at ? new Date(ev.starts_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(ev.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <DialogTitle className="font-display tracking-wider">{editing ? 'Edit Event' : 'New Event'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Row label="Title"><Input value={form.title} onChange={f('title')} /></Row>
            <Row label="Description"><Textarea value={form.description} onChange={f('description')} rows={2} /></Row>
            <div className="grid grid-cols-3 gap-3">
              <Row label="Format">
                <select value={form.format} onChange={f('format')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {['irl','zoom','hybrid'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                </select>
              </Row>
              <Row label="Status">
                <select value={form.status} onChange={f('status')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {['draft','live','paused','ended'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="Difficulty">
                <select value={form.difficulty} onChange={f('difficulty')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {['beginner','intermediate','advanced'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
            </div>
            <Row label="Location"><Input value={form.location} onChange={f('location')} placeholder="City, Venue" /></Row>
            <Row label="Zoom URL"><Input value={form.zoom_url} onChange={f('zoom_url')} placeholder="https://zoom.us/j/…" /></Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Starts At"><Input type="datetime-local" value={form.starts_at} onChange={f('starts_at')} /></Row>
              <Row label="Ends At"><Input type="datetime-local" value={form.ends_at} onChange={f('ends_at')} /></Row>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Category"><Input value={form.category} onChange={f('category')} /></Row>
              <Row label="Capacity"><Input type="number" value={form.capacity} onChange={f('capacity')} /></Row>
            </div>
            <Row label="Reward Pool"><Input value={form.reward_pool} onChange={f('reward_pool')} placeholder="$5,000 + NFTs" /></Row>
            <Row label="Cover Emoji"><Input value={form.cover_emoji} onChange={f('cover_emoji')} className="w-16" /></Row>
            <Row label="Tracks (comma-separated)"><Input value={form.tracks} onChange={f('tracks')} placeholder="student, developer, builder" /></Row>
            <Row label="Mission IDs (comma-separated)"><Input value={form.missions} onChange={f('missions')} placeholder="wallet-setup, av-explorer-quiz" /></Row>
            <Row label="Agenda JSON"><Textarea value={form.agenda_json} onChange={f('agenda_json')} rows={4} className="font-mono text-xs" /></Row>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save Event'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
