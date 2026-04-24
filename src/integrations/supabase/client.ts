// Neon-backed Supabase-compatible client shim
// Replaces @supabase/supabase-js — all API routes call /api/*

const TOKEN_KEY = 'ppa_token';

function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const [, b64] = token.split('.');
    const pad = b64.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(pad));
  } catch { return null; }
}

function buildUser(payload: Record<string, any>) {
  return {
    id: payload.sub as string,
    email: payload.email as string,
    user_metadata: (payload.user_metadata ?? {}) as Record<string, any>,
    app_metadata: { is_admin: payload.is_admin ?? false },
    aud: 'authenticated',
    created_at: '',
    role: 'authenticated',
  };
}

function buildSession(token: string, payload: Record<string, any>) {
  return { access_token: token, refresh_token: '', token_type: 'bearer', user: buildUser(payload), expires_at: payload.exp };
}

// ── Auth state listeners ────────────────────────────────────────────────
type AuthCb = (event: string, session: any) => void;
const _listeners: AuthCb[] = [];
function _notify(event: string, session: any) {
  _listeners.forEach(fn => fn(event, session));
}

// ── API fetch helper ────────────────────────────────────────────────────
async function apiFetch(path: string, body: any) {
  const token = getToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── QueryBuilder ────────────────────────────────────────────────────────
class QueryBuilder {
  private _table: string;
  private _op: string = 'select';
  private _select: string = '*';
  private _data: any = null;
  private _filters: { col: string; op: string; val: any }[] = [];
  private _order: { col: string; ascending: boolean }[] = [];
  private _limit: number | null = null;
  private _onConflict: string | null = null;

  constructor(table: string) { this._table = table; }

  select(cols: string = '*', opts?: { count?: string; head?: boolean }) {
    this._op = opts?.head ? 'count' : 'select';
    this._select = cols;
    return this;
  }
  insert(data: any) { this._op = 'insert'; this._data = data; return this; }
  update(data: any) { this._op = 'update'; this._data = data; return this; }
  upsert(data: any, opts?: { onConflict?: string }) {
    this._op = 'upsert'; this._data = data; this._onConflict = opts?.onConflict ?? null; return this;
  }
  delete() { this._op = 'delete'; return this; }

  eq(col: string, val: any)  { this._filters.push({ col, op: 'eq', val }); return this; }
  neq(col: string, val: any) { this._filters.push({ col, op: 'neq', val }); return this; }
  in(col: string, val: any[]) { this._filters.push({ col, op: 'in', val }); return this; }
  gt(col: string, val: any)  { this._filters.push({ col, op: 'gt', val }); return this; }
  gte(col: string, val: any) { this._filters.push({ col, op: 'gte', val }); return this; }
  lt(col: string, val: any)  { this._filters.push({ col, op: 'lt', val }); return this; }
  lte(col: string, val: any) { this._filters.push({ col, op: 'lte', val }); return this; }
  ilike(col: string, val: any) { this._filters.push({ col, op: 'like', val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order.push({ col, ascending: opts?.ascending ?? true }); return this;
  }
  limit(n: number) { this._limit = n; return this; }

  async single(): Promise<{ data: any; error: any }> { return this._exec(true, false); }
  async maybeSingle(): Promise<{ data: any; error: any }> { return this._exec(false, true); }
  then(resolve: (v: { data: any; error: any }) => any, reject?: (e: any) => any) {
    return this._exec(false, false).then(resolve, reject);
  }

  private async _exec(single: boolean, maybeSingle: boolean): Promise<{ data: any; error: any }> {
    return apiFetch('/api/db', {
      table: this._table, op: this._op, select: this._select,
      data: this._data, filters: this._filters, order: this._order,
      limit: this._limit, single, maybeSingle, onConflict: this._onConflict,
    });
  }
}

// ── PollingChannel ──────────────────────────────────────────────────────
type PgChangeConfig = { event: string; schema: string; table: string; filter?: string };
type PgChangeCb = (payload: { new: any; old: any }) => void;

class PollingChannel {
  private _handlers: { config: PgChangeConfig; cb: PgChangeCb }[] = [];
  private _timers: ReturnType<typeof setInterval>[] = [];
  private _name: string;

  constructor(name: string) { this._name = name; }

  on(_event: 'postgres_changes', config: PgChangeConfig, cb: PgChangeCb) {
    this._handlers.push({ config, cb });
    return this;
  }

  subscribe() {
    const isArena = this._name.startsWith('arena-');
    const interval = isArena ? 1500 : 10000;

    // Group handlers by table+filter
    const groups = new Map<string, { config: PgChangeConfig; cb: PgChangeCb }[]>();
    for (const h of this._handlers) {
      const key = `${h.config.table}|${h.config.filter ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(h);
    }

    for (const [, handlers] of groups) {
      const { table, filter } = handlers[0].config;
      const filters = parseFilter(filter);
      let snapshot: any[] = [];
      let initialized = false;

      const poll = async () => {
        try {
          const result = await apiFetch('/api/db', { table, op: 'select', select: '*', filters, order: [], limit: null });
          const rows: any[] = result.data ?? [];

          if (!initialized) { snapshot = rows; initialized = true; return; }

          const oldMap = new Map(snapshot.map((r: any) => [r.id, r]));
          const newMap = new Map(rows.map((r: any) => [r.id, r]));

          for (const [id, row] of newMap) {
            if (!oldMap.has(id)) {
              handlers.filter(h => h.config.event === '*' || h.config.event === 'INSERT').forEach(h => h.cb({ new: row, old: {} }));
            } else {
              const old = oldMap.get(id);
              if (JSON.stringify(old) !== JSON.stringify(row)) {
                handlers.filter(h => h.config.event === '*' || h.config.event === 'UPDATE').forEach(h => h.cb({ new: row, old }));
              }
            }
          }
          for (const [id, old] of oldMap) {
            if (!newMap.has(id)) {
              handlers.filter(h => h.config.event === '*' || h.config.event === 'DELETE').forEach(h => h.cb({ new: {}, old }));
            }
          }
          snapshot = rows;
        } catch { /* ignore poll errors */ }
      };

      poll(); // immediate first poll
      this._timers.push(setInterval(poll, interval));
    }
    return this;
  }

  unsubscribe() {
    this._timers.forEach(clearInterval);
    this._timers = [];
    return this;
  }
}

function parseFilter(filter?: string): { col: string; op: string; val: any }[] {
  if (!filter) return [];
  const m = filter.match(/^(\w+)=(\w+)\.(.+)$/);
  if (!m) return [];
  return [{ col: m[1], op: m[2], val: m[3] }];
}

// ── Auth object ─────────────────────────────────────────────────────────
const auth = {
  onAuthStateChange(cb: AuthCb) {
    _listeners.push(cb);
    const token = getToken();
    if (token) {
      const payload = decodeJwt(token);
      if (payload && payload.exp * 1000 > Date.now()) {
        setTimeout(() => cb('SIGNED_IN', buildSession(token, payload)), 0);
      } else {
        clearToken();
        setTimeout(() => cb('INITIAL_SESSION', null), 0);
      }
    } else {
      setTimeout(() => cb('INITIAL_SESSION', null), 0);
    }
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = _listeners.indexOf(cb);
            if (i !== -1) _listeners.splice(i, 1);
          },
        },
      },
    };
  },

  async getSession() {
    const token = getToken();
    if (!token) return { data: { session: null }, error: null };
    const payload = decodeJwt(token);
    if (!payload || payload.exp * 1000 < Date.now()) {
      clearToken(); return { data: { session: null }, error: null };
    }
    return { data: { session: buildSession(token, payload) }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { data: { session: null, user: null }, error: { message: data.error } };
      setToken(data.token);
      const payload = decodeJwt(data.token)!;
      const session = buildSession(data.token, payload);
      _notify('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: { message: e.message } };
    }
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password,
          username: options?.data?.username,
          emoji: options?.data?.emoji ?? '🔺',
        }),
      });
      const data = await res.json();
      if (data.error) return { data: { session: null, user: null }, error: { message: data.error } };
      setToken(data.token);
      const payload = decodeJwt(data.token)!;
      const session = buildSession(data.token, payload);
      _notify('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: { message: e.message } };
    }
  },

  async signOut() {
    clearToken();
    _notify('SIGNED_OUT', null);
    return { error: null };
  },
};

// ── RPC ──────────────────────────────────────────────────────────────────
async function rpc(fn: string, params?: Record<string, any>) {
  return apiFetch('/api/rpc', { fn, params: params ?? {} });
}

// ── Channel management ───────────────────────────────────────────────────
const _channels = new Map<string, PollingChannel>();

export const supabase = {
  auth,
  from(table: string) { return new QueryBuilder(table); },
  rpc,
  channel(name: string) {
    const ch = new PollingChannel(name);
    _channels.set(name, ch);
    return ch;
  },
  removeChannel(ch: PollingChannel) { ch.unsubscribe(); },
  functions: {
    async invoke(name: string, opts?: { body?: any }) {
      return apiFetch('/api/fn', { name, payload: opts?.body ?? {} });
    },
  },
};
