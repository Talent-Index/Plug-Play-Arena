import { neon } from '@neondatabase/serverless';

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export function qi(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
}

// FK relationships for !inner / !left join notation
const FK_MAP: Record<string, Record<string, { fk: string; ref_pk: string }>> = {
  mission_attempts:      { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
  challenge_submissions: { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
  nft_mints:             { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
  nft_badges:            { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
  quest_submissions:     { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
  event_participants:    { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
  arena_players:         { profiles: { fk: 'user_id', ref_pk: 'user_id' } },
};

interface JoinSpec { alias: string; joinType: string; cols: string[]; fk: string; ref_pk: string }

function parseSelect(table: string, select: string) {
  const pattern = /(\w+)!(inner|left|outer)\(([^)]+)\)/g;
  const joins: JoinSpec[] = [];
  let rest = select;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(select)) !== null) {
    const [full, refTable, qualifier, colList] = m;
    const fkInfo = FK_MAP[table]?.[refTable];
    if (!fkInfo) throw new Error(`No FK mapping: ${table} → ${refTable}`);
    joins.push({
      alias: refTable, joinType: qualifier === 'inner' ? 'INNER JOIN' : 'LEFT JOIN',
      cols: colList.split(',').map(c => c.trim()),
      fk: fkInfo.fk, ref_pk: fkInfo.ref_pk,
    });
    rest = rest.replace(full, '').replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/,\s*$/, '').trim();
  }
  return { mainCols: rest || '*', joins };
}

export interface Filter { col: string; op: string; val: any }
export interface OrderSpec { col: string; ascending: boolean }

export function buildSelectSql(
  table: string, select: string,
  filters: Filter[], order: OrderSpec[], limit: number | null, params: any[],
): string {
  const t = `public.${qi(table)}`;
  const { mainCols, joins } = parseSelect(table, select);

  const selectParts: string[] = [];
  if (mainCols === '*' || mainCols === '') {
    selectParts.push(`${t}.*`);
  } else {
    selectParts.push(
      mainCols.split(',').map(c => {
        const col = c.trim();
        if (col.includes('.') || col.includes('(') || col === '*') return col;
        return `${t}.${qi(col)}`;
      }).join(', ')
    );
  }

  const joinClauses: string[] = [];
  for (const j of joins) {
    const ref = `public.${qi(j.alias)}`;
    joinClauses.push(`${j.joinType} ${ref} ON ${ref}.${qi(j.ref_pk)} = ${t}.${qi(j.fk)}`);
    const fields = j.cols.map(c => `'${c}', ${ref}.${qi(c)}`).join(', ');
    selectParts.push(`jsonb_build_object(${fields}) AS ${qi(j.alias)}`);
  }

  const whereParts: string[] = [];
  for (const f of filters) {
    const col = `${t}.${qi(f.col)}`;
    params.push(f.val);
    const p = `$${params.length}`;
    if (f.op === 'eq')   { whereParts.push(`${col} = ${p}`); continue; }
    if (f.op === 'neq')  { whereParts.push(`${col} != ${p}`); continue; }
    if (f.op === 'in') {
      // Remove the already-pushed param and expand into individual placeholders
      params.pop();
      const vals: any[] = Array.isArray(f.val) ? f.val : [f.val];
      const placeholders = vals.map(v => { params.push(v); return `$${params.length}`; }).join(', ');
      whereParts.push(`${col} IN (${placeholders})`);
      continue;
    }
    if (f.op === 'gt')   { whereParts.push(`${col} > ${p}`); continue; }
    if (f.op === 'gte')  { whereParts.push(`${col} >= ${p}`); continue; }
    if (f.op === 'lt')   { whereParts.push(`${col} < ${p}`); continue; }
    if (f.op === 'lte')  { whereParts.push(`${col} <= ${p}`); continue; }
    if (f.op === 'like') { whereParts.push(`${col} ILIKE ${p}`); continue; }
  }

  const parts = [
    `SELECT ${selectParts.join(', ')} FROM ${t}`,
    ...joinClauses,
    whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '',
    order.length ? `ORDER BY ${order.map(o => `${t}.${qi(o.col)} ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}` : '',
    limit != null ? (params.push(limit), `LIMIT $${params.length}`) : '',
  ].filter(Boolean);
  return parts.join(' ');
}

export function buildInsertSql(table: string, data: Record<string, any>, params: any[]): string {
  const t = `public.${qi(table)}`;
  const keys = Object.keys(data).filter(k => data[k] !== undefined);
  if (!keys.length) throw new Error('No data to insert');
  const cols = keys.map(qi).join(', ');
  const vals = keys.map(k => { params.push(data[k]); return `$${params.length}`; }).join(', ');
  return `INSERT INTO ${t} (${cols}) VALUES (${vals}) RETURNING *`;
}

export function buildUpdateSql(
  table: string, data: Record<string, any>, filters: Filter[], params: any[]
): string {
  const t = `public.${qi(table)}`;
  const keys = Object.keys(data).filter(k => data[k] !== undefined);
  if (!keys.length) throw new Error('No data to update');
  const sets = keys.map(k => { params.push(data[k]); return `${qi(k)} = $${params.length}`; }).join(', ');
  const where = filters.map(f => { params.push(f.val); return `${t}.${qi(f.col)} = $${params.length}`; });
  return `UPDATE ${t} SET ${sets}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} RETURNING *`;
}

export function buildUpsertSql(
  table: string, data: Record<string, any>, onConflict: string | null, params: any[]
): string {
  const t = `public.${qi(table)}`;
  const keys = Object.keys(data).filter(k => data[k] !== undefined);
  if (!keys.length) throw new Error('No data to upsert');
  const cols = keys.map(qi).join(', ');
  const vals = keys.map(k => { params.push(data[k]); return `$${params.length}`; }).join(', ');
  const conflictStr = onConflict
    ? `ON CONFLICT (${onConflict.split(',').map(c => qi(c.trim())).join(', ')}) DO UPDATE SET ${keys.map(k => `${qi(k)} = EXCLUDED.${qi(k)}`).join(', ')}`
    : 'ON CONFLICT DO NOTHING';
  return `INSERT INTO ${t} (${cols}) VALUES (${vals}) ${conflictStr} RETURNING *`;
}

export function buildDeleteSql(table: string, filters: Filter[], params: any[]): string {
  const t = `public.${qi(table)}`;
  const where = filters.map(f => { params.push(f.val); return `${t}.${qi(f.col)} = $${params.length}`; });
  return `DELETE FROM ${t}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} RETURNING *`;
}
