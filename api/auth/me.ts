import { getDb } from '../_lib/db';
import { verifyToken, extractToken } from '../_lib/auth';
import { json, handleCors } from '../_lib/cors';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  const token = extractToken(req);
  if (!token) { json(res, 401, { error: 'Unauthorized' }); return; }

  try {
    const payload = await verifyToken(token);
    const userId = payload.sub as string;
    const sql = getDb();

    const profiles = await sql`
      SELECT username, emoji, persona, is_admin, xp, level, stage, streak
      FROM public.profiles WHERE user_id = ${userId}
    `;
    const profile = profiles[0] ?? {};

    json(res, 200, {
      user: {
        id: userId,
        email: payload.email,
        user_metadata: { username: profile.username, emoji: profile.emoji },
        is_admin: profile.is_admin ?? false,
      },
      profile,
    });
  } catch (err: any) {
    json(res, 401, { error: 'Invalid token' });
  }
}
