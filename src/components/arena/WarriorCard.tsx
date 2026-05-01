import { Warrior } from '@/lib/web3/mockContracts';

export function WarriorCard({ w, onClick, selected }: { w: Warrior; onClick?: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border bg-card p-3 text-left transition-all ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{w.emoji}</span>
          <div>
            <div className="text-sm font-medium">{w.class}</div>
            <div className="text-[10px] text-muted-foreground">Lv {w.level} · {w.xp} XP</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">HP {w.health}</div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
        <Stat label="PWR" v={w.power} />
        <Stat label="SPD" v={w.speed} />
        <Stat label="DEF" v={w.defense} />
      </div>
    </button>
  );
}
function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded bg-muted px-1.5 py-1 text-center">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono">{v}</div>
    </div>
  );
}