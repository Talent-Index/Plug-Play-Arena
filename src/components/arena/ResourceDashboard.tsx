interface Props {
  arena: number;
  energy: number;
  validators: number;
  chainHealth: number;
  territories: number;
  warriors: number;
  xp: number;
}
export function ResourceDashboard(p: Props) {
  const cells: Array<[string, string | number, string]> = [
    ['ARENA', p.arena, '🪙'],
    ['Energy', p.energy, '⚡'],
    ['Validators', p.validators, '🛡️'],
    ['Chain HP', p.chainHealth, '❤️'],
    ['Territories', p.territories, '🗺️'],
    ['Warriors', p.warriors, '⚔️'],
    ['XP', p.xp, '✨'],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
      {cells.map(([label, value, emoji]) => (
        <div key={label} className="rounded-lg border border-border bg-card p-2 text-center">
          <div className="text-base">{emoji}</div>
          <div className="font-mono text-sm">{value}</div>
          <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  );
}