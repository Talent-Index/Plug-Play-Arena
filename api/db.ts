import { getDb, buildSelectSql, buildInsertSql, buildUpdateSql, buildUpsertSql, buildDeleteSql } from './_lib/db';
import { verifyToken, extractToken } from './_lib/auth';
import { readBody, json, handleCors } from './_lib/cors';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

  const body = await readBody(req);
  const { table, op, select = '*', data, filters = [], order = [], limit = null, single = false, maybeSingle = false, onConflict = null } = body;

  if (!table) { json(res, 400, { error: 'table is required' }); return; }

  // Extract optional auth
  const token = extractToken(req);
  let userId: string | null = null;
  if (token) {
    try {
      const payload = await verifyToken(token);
      userId = payload.sub as string;
    } catch { /* anonymous query */ }
  }

  try {
    const sql = getDb();
    const params: any[] = [];
    let queryText: string;

    switch (op) {
      case 'count': {
        // COUNT(*) for head:true queries
        const cParams: any[] = [];
        const cSql = buildSelectSql(table, 'id', filters, [], null, cParams);
        const countSql = `SELECT COUNT(*) AS count FROM (${cSql}) _sub`;
        const cRows: any[] = await sql.query(countSql, cParams);
        const count = parseInt(cRows[0]?.count ?? 0, 10);
        json(res, 200, { data: [], count, error: null });
        return;
      }
      case 'select':
        queryText = buildSelectSql(table, select, filters, order, limit, params);
        break;
      case 'insert':
        if (!data) { json(res, 400, { error: 'data required for insert' }); return; }
        queryText = buildInsertSql(table, Array.isArray(data) ? data[0] : data, params);
        break;
      case 'update':
        if (!data) { json(res, 400, { error: 'data required for update' }); return; }
        queryText = buildUpdateSql(table, data, filters, params);
        break;
      case 'upsert':
        if (!data) { json(res, 400, { error: 'data required for upsert' }); return; }
        queryText = buildUpsertSql(table, Array.isArray(data) ? data[0] : data, onConflict, params);
        break;
      case 'delete':
        queryText = buildDeleteSql(table, filters, params);
        break;
      default:
        json(res, 400, { error: `Unknown op: ${op}` });
        return;
    }

    const rows: any[] = await sql.query(queryText, params);

    if (single) {
      if (!rows || rows.length === 0) {
        json(res, 406, { data: null, error: { message: 'No rows found', code: 'PGRST116' } });
        return;
      }
      json(res, 200, { data: rows[0], error: null });
      return;
    }

    if (maybeSingle) {
      json(res, 200, { data: rows?.[0] ?? null, error: null });
      return;
    }

    // For insert/update/upsert returning one row, unwrap the array
    if ((op === 'insert' || op === 'update' || op === 'upsert') && rows.length === 1) {
      json(res, 200, { data: rows[0], error: null });
      return;
    }

    json(res, 200, { data: rows ?? [], error: null });
  } catch (err: any) {
    json(res, 500, { data: null, error: { message: err.message } });
  }
}
