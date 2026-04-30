import { neon, neonConfig } from '@neondatabase/serverless';
import https from 'node:https';
import dns from 'node:dns/promises';

// Cache the first reachable IP per hostname to avoid repeated probing
const _ipCache = new Map<string, string>();

async function httpsRequest(
  ip: string, hostname: string, path: string,
  method: string, headers: Record<string, string>, body?: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body) : undefined;
    const req = https.request({
      hostname: ip, port: 443, path, method,
      servername: hostname, rejectUnauthorized: false,
      headers: {
        ...headers,
        Host: hostname,
        ...(bodyBuf ? { 'Content-Length': String(bodyBuf.length) } : {}),
      },
      timeout: 20000,
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 200, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('https timeout')); });
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function neonFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const path = parsed.pathname + parsed.search;
  const method = (opts.method as string) ?? 'GET';
  const headers = (opts.headers ?? {}) as Record<string, string>;
  const body = opts.body as string | undefined;

  // Use cached working IP if available
  const cached = _ipCache.get(hostname);
  if (cached) {
    const r = await httpsRequest(cached, hostname, path, method, headers, body);
    return new Response(r.text, { status: r.status });
  }

  // Probe all IPs and cache the first that responds
  const ips = await dns.resolve4(hostname).catch(() => [] as string[]);
  if (!ips.length) ips.push(hostname); // fallback to hostname

  for (const ip of ips) {
    try {
      const r = await httpsRequest(ip, hostname, path, method, headers, body);
      _ipCache.set(hostname, ip);
      return new Response(r.text, { status: r.status });
    } catch {
      // try next
    }
  }
  throw new Error(`Neon: all IPs unreachable for ${hostname}`);
}

// Use the endpoint-specific /sql URL instead of the api. prefix (which is blocked)
neonConfig.fetchEndpoint = (host: string) => `https://${host}/sql`;
neonConfig.fetchFunction = neonFetch as any;

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
    if (f.op === 'is_null') { params.pop(); whereParts.push(`${col} IS NULL`); continue; }
    if (f.op === 'not_null') { params.pop(); whereParts.push(`${col} IS NOT NULL`); continue; }
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
