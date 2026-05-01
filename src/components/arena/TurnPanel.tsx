import { useEffect, useState } from 'react';

interface Props {
  currentNickname: string | null;
  isMyTurn: boolean;
  round: number;
  maxRounds: number;
  actionsRemaining: number;
  turnStartedAt: string | null;
  turnSeconds: number;
  onEndTurn?: () => void;
}

export function TurnPanel({ currentNickname, isMyTurn, round, maxRounds, actionsRemaining, turnStartedAt, turnSeconds, onEndTurn }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);
  const elapsed = turnStartedAt ? Math.floor((now - new Date(turnStartedAt).getTime()) / 1000) : 0;
  const left = Math.max(0, turnSeconds - elapsed);
  const low = left <= 5;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Round {round} / {maxRounds}</div>
        <div className="font-display text-sm tracking-wider">
          {isMyTurn ? 'Your turn' : `${currentNickname ?? '—'}'s turn`}
        </div>
      </div>
      <div className={`font-display text-2xl tracking-wider ${low ? 'text-destructive animate-pulse' : ''}`}>{String(left).padStart(2, '0')}s</div>
      <div className="text-xs">
        Actions: <span className="font-mono">{actionsRemaining}</span>
      </div>
      {isMyTurn && onEndTurn && (
        <button onClick={onEndTurn} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">End turn</button>
      )}
    </div>
  );
}