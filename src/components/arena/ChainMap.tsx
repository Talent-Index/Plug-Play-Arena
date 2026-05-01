import { Tile, BOARD_COLS } from '@/lib/arena/modes';

interface Props {
  tiles: Tile[];
  playerColors: Record<string, string>;
  selectedTile?: { r: number; c: number } | null;
  onTileClick?: (t: Tile) => void;
}

export function ChainMap({ tiles, playerColors, selectedTile, onTileClick }: Props) {
  return (
    <div
      className="grid gap-1.5 rounded-xl border border-border bg-card p-3"
      style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))` }}
    >
      {tiles.map((t) => {
        const owner = t.ownerPlayerId ? playerColors[t.ownerPlayerId] : undefined;
        const isSelected = selectedTile?.r === t.r && selectedTile?.c === t.c;
        return (
          <button
            key={`${t.r}-${t.c}`}
            onClick={() => onTileClick?.(t)}
            className={`relative aspect-square rounded-md border transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
            style={{
              background: owner ? `${owner}33` : 'hsl(var(--muted))',
              borderColor: owner ?? 'hsl(var(--border))',
            }}
            title={`(${t.r},${t.c})${t.isBase ? ' · BASE' : ''} HP ${t.health}`}
          >
            {t.isBase && <span className="absolute inset-0 grid place-items-center text-lg">🏰</span>}
            {!t.isBase && t.ownerPlayerId && <span className="absolute inset-0 grid place-items-center text-[10px] font-mono">{t.health}</span>}
          </button>
        );
      })}
    </div>
  );
}