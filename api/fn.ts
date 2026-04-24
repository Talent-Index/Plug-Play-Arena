import { getDb } from './_lib/db.js';
import { verifyToken, extractToken } from './_lib/auth.js';
import { readBody, json, handleCors } from './_lib/cors.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

  const body = await readBody(req);
  const { name, payload: fnBody = {} } = body;
  if (!name) { json(res, 400, { error: 'name is required' }); return; }

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

    switch (name) {
      case 'verify-submission': {
        const { submission_id } = fnBody;
        if (!submission_id) { json(res, 400, { error: 'submission_id required' }); return; }
        await sql`
          UPDATE public.challenge_submissions
          SET status = 'verified', verified = true
          WHERE id = ${submission_id}
        `;
        json(res, 200, { data: { status: 'verified' }, error: null });
        return;
      }

      case 'verify-challenge': {
        // Mark submission as verified in DB
        const { attempt_id, tx_hash } = fnBody;
        if (!attempt_id) { json(res, 400, { error: 'attempt_id required' }); return; }
        await sql`
          UPDATE public.mission_attempts
          SET status = 'verified', verified = true, tx_hash = ${tx_hash ?? null}
          WHERE id = ${attempt_id}
        `;
        json(res, 200, { data: { verified: true }, error: null });
        return;
      }

      case 'mint-badge-fuji': {
        const { badge_id, wallet_address } = fnBody;
        if (!badge_id) { json(res, 400, { error: 'badge_id required' }); return; }
        // Record the mint attempt in nft_mints table
        await sql`
          INSERT INTO public.nft_mints (user_id, badge_id, status, game_id)
          SELECT user_id, ${badge_id}, 'pending', game_id
          FROM public.nft_badges WHERE id = ${badge_id}
          ON CONFLICT DO NOTHING
        `;
        json(res, 200, { data: { status: 'pending', message: 'Mint queued' }, error: null });
        return;
      }

      case 'deploy-nft-contract': {
        json(res, 200, { data: { status: 'stub', message: 'Contract deployment not configured' }, error: null });
        return;
      }

      default:
        json(res, 404, { error: `Unknown function: ${name}` });
    }
  } catch (err: any) {
    json(res, 500, { data: null, error: { message: err.message } });
  }
}
