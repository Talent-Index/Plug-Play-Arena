import { getDb } from '../_lib/db';
import { verifyToken, extractToken } from '../_lib/auth';
import { readBody, json, handleCors } from '../_lib/cors';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

  const token = extractToken(req);
  if (!token) { json(res, 401, { error: 'Sign in to submit quests' }); return; }

  let userId: string;
  try {
    const payload = await verifyToken(token);
    userId = payload.sub as string;
  } catch {
    json(res, 401, { error: 'Invalid token' }); return;
  }

  const { quest_id, evidence } = await readBody(req);
  if (!quest_id) { json(res, 400, { error: 'quest_id is required' }); return; }
  if (!evidence || !String(evidence).trim()) { json(res, 400, { error: 'Evidence is required' }); return; }

  const sql = getDb();

  try {
    // Load quest to get XP value
    const quests = await sql`SELECT id, xp_reward, is_active FROM public.quests WHERE id = ${quest_id}`;
    const quest = quests[0];
    if (!quest) { json(res, 404, { error: 'Quest not found' }); return; }
    if (!quest.is_active) { json(res, 400, { error: 'Quest is no longer active' }); return; }

    // Check for existing submission
    const existing = await sql`
      SELECT id, status FROM public.quest_submissions
      WHERE user_id = ${userId} AND quest_id = ${quest_id}
    `;
    if (existing.length > 0) {
      json(res, 409, { error: 'You have already submitted this quest', submission: existing[0] });
      return;
    }

    // Insert submission — auto-approve and award XP
    const rows = await sql`
      INSERT INTO public.quest_submissions (user_id, quest_id, evidence, status, xp_awarded)
      VALUES (${userId}, ${quest_id}, ${String(evidence).trim()}, 'approved', ${quest.xp_reward})
      RETURNING *
    `;
    const submission = rows[0];

    // Award XP to profile
    await sql`
      UPDATE public.profiles
      SET xp = xp + ${quest.xp_reward},
          updated_at = now()
      WHERE user_id = ${userId}
    `;

    json(res, 201, { data: submission, error: null });
  } catch (err: any) {
    json(res, 500, { error: err.message });
  }
}
