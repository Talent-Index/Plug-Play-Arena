import { getDb, qi } from './_lib/db.js';
import { verifyToken, extractToken } from './_lib/auth.js';
import { readBody, json, handleCors } from './_lib/cors.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

  const body = await readBody(req);
  const { fn, params: rpcParams = {} } = body;
  if (!fn) { json(res, 400, { error: 'fn is required' }); return; }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fn)) { json(res, 400, { error: 'Invalid function name' }); return; }

  const token = extractToken(req);
  let userId: string | null = null;
  if (token) {
    try {
      const payload = await verifyToken(token);
      userId = payload.sub as string;
    } catch { /* anonymous */ }
  }

  try {
    const sql = getDb();
    const sqlParams: any[] = [];

    // Build named-parameter call: fn(_key => $1, _key2 => $2)
    const paramEntries = Object.entries(rpcParams ?? {});
    const namedArgs = paramEntries.map(([k, v]) => {
      sqlParams.push(v);
      return `${k} => $${sqlParams.length}`;
    }).join(', ');

    const fnSql = `SELECT * FROM public.${qi(fn)}(${namedArgs})`;

    let rows: any[];

    if (userId) {
      // Run SET + function call in same transaction so auth.uid() works
      const setQuery = sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      const fnQuery = sql.query(fnSql, sqlParams);
      const results = await sql.transaction([setQuery, fnQuery]);
      rows = results[1] as any[];
    } else {
      rows = await sql.query(fnSql, sqlParams) as any[];
    }

    // Smart result unwrapping
    if (!rows || rows.length === 0) {
      json(res, 200, { data: null, error: null });
      return;
    }

    const keys = Object.keys(rows[0]);
    if (keys.length === 1) {
      // Single column — scalar or JSONB return
      const colName = keys[0];
      if (rows.length === 1) {
        json(res, 200, { data: rows[0][colName], error: null });
      } else {
        json(res, 200, { data: rows.map(r => r[colName]), error: null });
      }
      return;
    }

    // Multiple columns — return as array
    json(res, 200, { data: rows, error: null });
  } catch (err: any) {
    json(res, 500, { data: null, error: { message: err.message } });
  }
}
