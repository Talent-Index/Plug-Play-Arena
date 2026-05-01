import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Shield, ShieldOff, Eye } from 'lucide-react';
import { toast } from 'sonner';

type Player = {
  id: string;
  username: string;
  emoji: string;
  persona: string;
  xp: number;
  is_admin: boolean;
  created_at: string;
};

type PlayerDetail = Player & {
  missions_count: number;
  nft_count: number;
  events_count: number;
};

export default function AdminPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filtered, setFiltered] = useState<Player[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchPlayers = useCallback(() => {
    setLoading(true);
    supabase
      .from('profiles')
      .select('id, username, emoji, persona, xp, is_admin, created_at')
      .order('xp', { ascending: false })
      .then(({ data }) => {
        if (data) { setPlayers(data as Player[]); setFiltered(data as Player[]); }
        setLoading(false);
      });
  }, []);

  useEffect(fetchPlayers, [fetchPlayers]);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(q ? players.filter(p => p.username.toLowerCase().includes(q) || p.persona.includes(q)) : players);
  }, [query, players]);

  async function toggleAdmin(player: Player) {
    const next = !player.is_admin;
    const label = next ? 'grant admin' : 'revoke admin';
    if (!confirm(`Are you sure you want to ${label} for ${player.username}?`)) return;
    const { error } = await supabase.from('profiles').update({ is_admin: next }).eq('id', player.id);
    if (error) toast.error(error.message);
    else { toast.success(`${player.username} is ${next ? 'now an admin' : 'no longer admin'}.`); fetchPlayers(); }
  }

  async function openDetail(player: Player) {
    const [missionsRes, nftsRes, eventsRes] = await Promise.all([
      supabase.from('mission_attempts').select('id', { count: 'exact', head: true }).eq('user_id', player.id).eq('status', 'completed'),
      supabase.from('nft_mints').select('id', { count: 'exact', head: true }).eq('user_id', player.id),
      supabase.from('event_participants').select('id', { count: 'exact', head: true }).eq('user_id', player.id),
    ]);
    setDetail({
      ...player,
      missions_count: (missionsRes as unknown as { count: number | null }).count ?? 0,
      nft_count: (nftsRes as unknown as { count: number | null }).count ?? 0,
      events_count: (eventsRes as unknown as { count: number | null }).count ?? 0,
    });
    setDetailOpen(true);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-wider">Players</h1>
          <p className="mt-1 text-sm text-muted-foreground">{players.length} registered players</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="pl-9 w-56" />
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">XP</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{p.emoji}</span>
                      <div className="font-medium">{p.username}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">{p.persona}</td>
                  <td className="px-4 py-3 font-display text-sm text-primary">{p.xp.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {p.is_admin
                      ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Admin</span>
                      : <span className="text-xs text-muted-foreground">Player</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(p)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button
                        size="sm" variant="ghost"
                        className={p.is_admin ? 'text-destructive hover:text-destructive' : 'text-primary hover:text-primary'}
                        onClick={() => toggleAdmin(p)}
                        title={p.is_admin ? 'Revoke admin' : 'Grant admin'}
                      >
                        {p.is_admin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {detail && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider flex items-center gap-2">
                <span className="text-2xl">{detail.emoji}</span> {detail.username}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              {[
                { label: 'XP Earned', value: detail.xp.toLocaleString() },
                { label: 'Missions Done', value: detail.missions_count },
                { label: 'NFTs Minted', value: detail.nft_count },
                { label: 'Events Joined', value: detail.events_count },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 font-display text-xl">{value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>Persona: <span className="capitalize text-foreground">{detail.persona}</span></div>
              <div>Role: <span className="text-foreground">{detail.is_admin ? 'Admin' : 'Player'}</span></div>
              <div>Joined: <span className="text-foreground">{new Date(detail.created_at).toLocaleDateString()}</span></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
