import { useEffect, useRef } from 'react';

export interface LogEntry { id: string; kind: string; message: string; created_at: string; }

export function BattleLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [entries.length]);
  return (
    <div ref={ref} className="h-48 overflow-y-auto rounded-xl border border-border bg-card p-3 text-xs">
      {entries.length === 0 ? (
        <div className="text-muted-foreground">Battle log will appear here…</div>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="text-muted-foreground tabular-nums">{new Date(e.created_at).toLocaleTimeString().slice(0, 5)}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}