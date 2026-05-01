import { MODES, ArenaMode } from '@/lib/arena/modes';
import { cn } from '@/lib/utils';

export function ModeSelector({ value, onChange }: { value: ArenaMode; onChange: (m: ArenaMode) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {MODES.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={cn(
              'rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/60',
              active ? 'border-primary ring-2 ring-primary/30' : 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{m.emoji}</span>
              <span className="font-display text-sm tracking-wider">{m.title}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{m.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {m.teaches.map((t) => (
                <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}