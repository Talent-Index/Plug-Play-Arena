import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Settings, Shield, Zap, Database } from 'lucide-react';

type AppSetting = { key: string; value: string; description?: string | null };

export default function AdminSettings() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').order('key')
      .then(({ data }) => {
        if (data) {
          setSettings(data as unknown as AppSetting[]);
          const initial: Record<string, string> = {};
          (data as unknown as AppSetting[]).forEach(s => { initial[s.key] = s.value; });
          setEdits(initial);
        }
        setLoading(false);
      });
  }, []);

  async function saveSetting(key: string) {
    setSaving(key);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: edits[key] }, { onConflict: 'key' });
    if (error) toast.error(error.message);
    else toast.success(`Saved: ${key}`);
    setSaving(null);
  }

  async function deployContract() {
    setDeploying(true);
    const { error } = await supabase.functions.invoke('deploy-nft-contract', {});
    if (error) toast.error(error.message);
    else toast.success('NFT contract deployment triggered. Check Supabase logs.');
    setDeploying(false);
  }

  async function seedArenaQuestions() {
    setSeeding(true);
    toast.info('Arena questions are managed via Supabase migrations. Use the Arena → Questions tab to add more.');
    setSeeding(false);
  }

  return (
    <div className="p-8 max-w-2xl space-y-10">
      <div>
        <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
          <Settings className="h-6 w-6 text-muted-foreground" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform configuration and admin actions</p>
      </div>

      {/* App Settings */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-wider">App Settings</h2>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : settings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No app settings configured. Create an <code className="font-mono text-xs">app_settings</code> table with columns <code className="font-mono text-xs">key</code>, <code className="font-mono text-xs">value</code>, <code className="font-mono text-xs">description</code>.
          </div>
        ) : (
          <div className="space-y-3">
            {settings.map(s => (
              <div key={s.key} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-1 text-xs font-medium font-mono">{s.key}</div>
                {s.description && <div className="mb-2 text-xs text-muted-foreground">{s.description}</div>}
                <div className="flex items-center gap-2">
                  <Input
                    value={edits[s.key] ?? ''}
                    onChange={e => setEdits(p => ({ ...p, [s.key]: e.target.value }))}
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveSetting(s.key)}
                    disabled={saving === s.key || edits[s.key] === s.value}
                  >
                    {saving === s.key ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin Actions */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-wider">Admin Actions</h2>
        </div>
        <div className="space-y-3">
          <ActionCard
            title="Deploy NFT Contract"
            description="Deploy the ERC-721 PlugPlayArena NFT contract to Avalanche Fuji testnet. Requires FUJI_MINTER_PRIVATE_KEY set in Supabase Edge Function secrets."
            icon={<Shield className="h-5 w-5 text-purple-400" />}
            buttonLabel={deploying ? 'Deploying…' : 'Deploy Contract'}
            onClick={deployContract}
            disabled={deploying}
            dangerous
          />
          <ActionCard
            title="Arena Question Seeding"
            description="Arena questions are managed via database migrations and the Arena admin page. Click to learn more."
            icon={<Zap className="h-5 w-5 text-yellow-400" />}
            buttonLabel="View Instructions"
            onClick={seedArenaQuestions}
            disabled={seeding}
          />
        </div>
      </section>

      {/* Environment Info */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm tracking-wider">Environment</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs font-mono">
          {[
            { key: 'VITE_SUPABASE_URL', val: import.meta.env.VITE_SUPABASE_URL ?? 'not set' },
            { key: 'VITE_SUPABASE_PROJECT_ID', val: import.meta.env.VITE_SUPABASE_PROJECT_ID ?? 'not set' },
            { key: 'Mode', val: import.meta.env.MODE },
          ].map(({ key, val }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-muted-foreground w-48 shrink-0">{key}</span>
              <span className="text-foreground truncate">{String(val)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActionCard({
  title, description, icon, buttonLabel, onClick, disabled, dangerous,
}: {
  title: string; description: string; icon: React.ReactNode;
  buttonLabel: string; onClick: () => void; disabled?: boolean; dangerous?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </div>
      <Button
        size="sm"
        variant={dangerous ? 'destructive' : 'outline'}
        onClick={onClick}
        disabled={disabled}
        className="shrink-0"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
