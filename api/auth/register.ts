import bcrypt from 'bcryptjs';
import { getDb } from '../_lib/db';
import { signToken } from '../_lib/auth';
import { readBody, json, handleCors } from '../_lib/cors';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

  const { email, password, username, emoji = '🔺' } = await readBody(req);
  if (!email || !password) { json(res, 400, { error: 'Email and password required' }); return; }
  if (password.length < 6) { json(res, 400, { error: 'Password must be at least 6 characters' }); return; }

  try {
    const sql = getDb();

    // Check if email already exists
    const existing = await sql`SELECT id FROM public.users WHERE email = ${email.toLowerCase().trim()}`;
    if (existing.length > 0) { json(res, 409, { error: 'An account with this email already exists' }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const finalUsername = (username || email.split('@')[0]).slice(0, 30);

    // Insert user — trigger will auto-create profile
    const newUsers = await sql`
      INSERT INTO public.users (email, password_hash, raw_user_meta_data)
      VALUES (
        ${email.toLowerCase().trim()},
        ${passwordHash},
        ${JSON.stringify({ username: finalUsername, emoji })}
      )
      RETURNING id, email
    `;
    const user = newUsers[0];

    // Update profile with the username/emoji from metadata
    await sql`
      UPDATE public.profiles
      SET username = ${finalUsername}, emoji = ${emoji}
      WHERE user_id = ${user.id}
    `;

    const token = await signToken({
      sub: user.id,
      email: user.email,
      user_metadata: { username: finalUsername, emoji },
      is_admin: false,
    });

    json(res, 201, { token, user: { id: user.id, email: user.email } });
  } catch (err: any) {
    json(res, 500, { error: err.message });
  }
}
