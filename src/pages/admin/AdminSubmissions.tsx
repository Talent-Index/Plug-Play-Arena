import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Submission = {
  id: string;
  player_id: string;
  game_id: string;
  status: string;
  score: number | null;
  submission_data: Record<string, string> | null;
  verified: boolean | null;
  tx_hash: string | null;
  completed_at: string | null;
  created_at: string;
  profiles: { username: string; emoji: string } | null;
};

const STATUS_PILL: Record<string, string> = {
  pending:   'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-green-500/15 text-green-400',
  failed:    'bg-red-500/15 text-red-400',
  verified:  'bg-blue-500/15 text-blue-400',
};

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filtered, setFiltered] = useState<Submission[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchSubmissions = useCallback(() => {
    setLoading(true);
    supabase
      .from('mission_attempts')
      .select('*, profiles!inner(username, emoji)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          const rows = data.map((r: unknown) => {
            const row = r as Submission & { profiles: { username: string; emoji: string } };
            return { ...row };
          });
          setSubmissions(rows);
          setFiltered(rows);
        }
        setLoading(false);
      });
  }, []);

  useEffect(fetchSubmissions, [fetchSubmissions]);

  useEffect(() => {
    let list = submissions;
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(s => s.profiles?.username.toLowerCase().includes(q) || s.game_id.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [query, statusFilter, submissions]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('mission_attempts').update({ status: status as 'completed' | 'failed' | 'in_progress' | 'timeout' }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Status → ${status}`); fetchSubmissions(); }
  }

  async function reverify(sub: Submission) {
    if (!sub.tx_hash) { toast.error('No tx_hash to verify'); return; }
    const { error } = await supabase.functions.invoke('verify-challenge', {
      body: { attempt_id: sub.id, tx_hash: sub.tx_hash },
    });
    if (error) toast.error(error.message);
    else { toast.success('Re-verification triggered.'); fetchSubmissions(); }
  }

  function openDetail(sub: Submission) { setSelected(sub); setDetailOpen(true); }

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-wider">Submissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {submissions.length} total · {pendingCount > 0 && <span className="text-yellow-400">{pendingCount} pending review</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="all">All statuses</option>
            {['pending','completed','failed','verified'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Player or game…" className="pl-9 w-48" />
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-left">Game</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No submissions found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => openDetail(s)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{s.profiles?.emoji}</span>
                      <div className="font-medium">{s.profiles?.username}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{s.game_id}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[s.status] ?? ''}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.score ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {s.status === 'pending' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-400" onClick={() => updateStatus(s.id, 'completed')} title="Approve">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => updateStatus(s.id, 'failed')} title="Reject">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {s.tx_hash && (
                        <Button size="sm" variant="ghost" onClick={() => reverify(s)} title="Re-verify on chain">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {selected && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider">Submission Detail</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Detail label="Player" value={`${selected.profiles?.emoji} ${selected.profiles?.username}`} />
                <Detail label="Game" value={selected.game_id} mono />
                <Detail label="Status" value={selected.status} />
                <Detail label="Score" value={selected.score ?? '—'} />
                <Detail label="Verified" value={selected.verified ? 'Yes' : 'No'} />
                <Detail label="Date" value={new Date(selected.created_at).toLocaleString()} />
              </div>

              {selected.tx_hash && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="mb-1 text-muted-foreground">Transaction Hash</div>
                  <a
                    href={`https://testnet.snowtrace.io/tx/${selected.tx_hash}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 font-mono text-primary hover:underline break-all"
                    onClick={e => e.stopPropagation()}
                  >
                    {selected.tx_hash} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}

              {selected.submission_data && Object.keys(selected.submission_data).length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="mb-1 text-muted-foreground">Submission Data</div>
                  {Object.entries(selected.submission_data).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground">{k}:</span>
                      <span className="font-mono break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              {selected.status === 'pending' && (
                <>
                  <Button variant="outline" className="text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={() => { updateStatus(selected.id, 'completed'); setDetailOpen(false); }}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { updateStatus(selected.id, 'failed'); setDetailOpen(false); }}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
