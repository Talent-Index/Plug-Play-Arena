DROP VIEW IF EXISTS public.unified_leaderboard;
CREATE VIEW public.unified_leaderboard
WITH (security_invoker = true) AS
WITH arena_xp AS (
  SELECT user_id, SUM(score) AS arena_score
    FROM public.arena_players
   WHERE user_id IS NOT NULL
   GROUP BY user_id
),
quest_xp AS (
  SELECT user_id, SUM(xp_awarded) AS quest_score
    FROM public.quest_submissions
   WHERE status = 'approved'
   GROUP BY user_id
)
SELECT
  p.user_id,
  p.username,
  p.emoji,
  p.wallet_address,
  p.builders_hub_signed,
  p.xp                           AS profile_xp,
  COALESCE(a.arena_score, 0)     AS arena_xp,
  COALESCE(q.quest_score, 0)     AS quest_xp,
  (p.xp + COALESCE(a.arena_score,0) + COALESCE(q.quest_score,0)) AS total_xp,
  RANK() OVER (ORDER BY (p.xp + COALESCE(a.arena_score,0) + COALESCE(q.quest_score,0)) DESC, p.created_at ASC) AS rank
FROM public.profiles p
LEFT JOIN arena_xp a ON a.user_id = p.user_id
LEFT JOIN quest_xp q ON q.user_id = p.user_id;
GRANT SELECT ON public.unified_leaderboard TO anon, authenticated;