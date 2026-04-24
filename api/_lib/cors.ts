export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export async function readBody(req: any): Promise<any> {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c: any) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export function json(res: any, status: number, body: any) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(data);
}

export function handleCors(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }
  return false;
}
