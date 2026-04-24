import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminStats } from '@/integrations/supabase/extended-types';
import { Users, Gamepad2, Zap, Gem, Calendar, Radio, FileCheck, Trophy } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentMissions, setRecentMissions] = useState<{ username: string; emoji: string; game_id: string; score: number; completed_at: string }[]>([]);
  const [recentUsers, setRecentUsers] = useState<{ username: string; emoji: string; persona: string; created_at: string }[]>([]);

  useEffect(() => {
    supabase.rpc('get_admin_stats').then(({ data }) => {
      if (data) setStats(data as unknown as AdminStats);
    });

    supabase
      .from('mission_attempts')
      .select('game_id, score, completed_at, profiles!inner(username, emoji)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) {
          setRecentMissions(data.map((r: unknown) => {
            const row = r as { game_id: string; score: number; completed_at: string; profiles: { username: string; emoji: string } };
            return { username: row.profiles.username, emoji: row.profiles.emoji, game_id: row.game_id, score: row.score, completed_at: row.completed_at };
          }));
        }
      });

    supabase
      .from('profiles')
      .select('username, emoji, persona, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setRecentUsers(data); });
  }, []);

  const statCards = stats ? [
    { label: 'Total Users',       value: stats.total_users,       icon: Users,     href: '/admin/players',     color: 'text-blue-400' },
    { label: 'Missions Completed',value: stats.total_missions,    icon: Gamepad2,  href: '/admin/games',       color: 'text-green-400' },
    { label: 'Total XP Awarded',  value: stats.total_xp.toLocaleString(), icon: Zap, href: '/admin/players', color: 'text-yellow-400' },
    { label: 'NFTs Minted',       value: stats.total_nft_mints,  icon: Gem,       href: '/admin/nfts',        color: 'text-purple-400' },
    { label: 'Active Events',     value: stats.active_events,    icon: Calendar,  href: '/admin/events',      color: 'text-primary' },
    { label: 'Arena Sessions',    value: stats.arena_sessions,   icon: Radio,     href: '/admin/arena',       color: 'text-pink-400' },
    { label: 'Pending Verifications', value: stats.pending_subs, icon: FileCheck, href: '/admin/submissions', color: 'text-orange-400' },
    { label: 'Verified Challenges', value: stats.total_challenges, icon: Trophy,  href: '/admin/submissions', color: 'text-cyan-400' },
  ] : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wider">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform overview — Plug n' Play Arena</p>
      </div>

      {/* Stats grid */}
      {!stats ? (
        <div className="text-sm text-muted-foreground">Loading stats…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, href, color }) => (
            <Link key={label} to={href} className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
              <Icon className={`h-5 w-5 ${color}`} />
              <div className="mt-3 font-display text-3xl tracking-wider">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* Recent missions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-5 py-3 flex items-center justify-between">
            <h2 className="font-display text-sm tracking-wider">Recent Missions</h2>
            <Link to="/admin/games" className="text-xs text-muted-foreground hover:text-primary">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {recentMissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">No missions yet.</div>
            ) : recentMissions.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{m.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{m.username}</div>
                    <div className="text-xs text-muted-foreground">{m.game_id}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-display text-primary">{m.score} pts</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(m.completed_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-5 py-3 flex items-center justify-between">
            <h2 className="font-display text-sm tracking-wider">New Players</h2>
            <Link to="/admin/players" className="text-xs text-muted-foreground hover:text-primary">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {recentUsers.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">No players yet.</div>
            ) : recentUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{u.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{u.username}</div>
                    <div className="text-xs text-muted-foreground capitalize">{u.persona}</div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
