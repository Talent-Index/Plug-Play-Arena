
-- =====================================================
-- PART 1: GAMES + CHALLENGES + EVENTS EXPANSION + ADMIN
-- (re-applies migration 20260422000001 that never ran)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.games (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  persona      TEXT NOT NULL,
  category     TEXT NOT NULL,
  difficulty   TEXT NOT NULL DEFAULT 'beginner',
  themes       TEXT[] NOT NULL DEFAULT '{}',
  description  TEXT NOT NULL DEFAULT '',
  learning_outcome TEXT NOT NULL DEFAULT '',
  emoji        TEXT NOT NULL DEFAULT '🎮',
  duration     TEXT NOT NULL DEFAULT '5 min',
  xp_reward    INTEGER NOT NULL DEFAULT 100,
  reward_type  TEXT NOT NULL DEFAULT 'xp' CHECK (reward_type IN ('xp','nft','merch','token')),
  event_types  TEXT[] NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','soon')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.challenges (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  tagline      TEXT NOT NULL DEFAULT '',
  emoji        TEXT NOT NULL DEFAULT '🏆',
  accent       TEXT NOT NULL DEFAULT 'cyan',
  tier         TEXT NOT NULL DEFAULT 'Beginner',
  ai_ready     BOOLEAN NOT NULL DEFAULT false,
  est_minutes  INTEGER NOT NULL DEFAULT 20,
  xp_reward    INTEGER NOT NULL DEFAULT 500,
  badge_title  TEXT NOT NULL DEFAULT '',
  concept      TEXT NOT NULL DEFAULT '',
  brief        TEXT NOT NULL DEFAULT '',
  steps        JSONB NOT NULL DEFAULT '[]',
  build_prompt TEXT NOT NULL DEFAULT '',
  ai_prompt    TEXT,
  submission   JSONB NOT NULL DEFAULT '{}',
  verification JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events
  ALTER COLUMN host_user_id DROP NOT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'community';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS zoom_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tracks TEXT[] DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'beginner';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS missions TEXT[] DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 100;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_platform_event BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE user_id = auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon, authenticated;

-- Policies (drop+create to be idempotent)
DROP POLICY IF EXISTS "Games viewable by everyone" ON public.games;
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage games" ON public.games;
CREATE POLICY "Admins manage games" ON public.games FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Challenges viewable by everyone" ON public.challenges;
CREATE POLICY "Challenges viewable by everyone" ON public.challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage challenges" ON public.challenges;
CREATE POLICY "Admins manage challenges" ON public.challenges FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all events" ON public.events;
CREATE POLICY "Admins manage all events" ON public.events FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_users',       (SELECT COUNT(*) FROM public.profiles),
    'total_missions',    (SELECT COUNT(*) FROM public.mission_attempts WHERE status = 'completed'),
    'total_xp',          (SELECT COALESCE(SUM(xp), 0) FROM public.profiles),
    'total_nft_mints',   (SELECT COUNT(*) FROM public.nft_mints),
    'active_events',     (SELECT COUNT(*) FROM public.events WHERE status IN ('live','draft')),
    'arena_sessions',    (SELECT COUNT(*) FROM public.game_sessions),
    'pending_subs',      (SELECT COUNT(*) FROM public.challenge_submissions WHERE status = 'pending'),
    'total_challenges',  (SELECT COUNT(*) FROM public.challenge_submissions WHERE status = 'verified')
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_admin_stats TO authenticated;

CREATE INDEX IF NOT EXISTS idx_games_persona   ON public.games(persona);
CREATE INDEX IF NOT EXISTS idx_games_status    ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_challenges_slug ON public.challenges(slug);
CREATE INDEX IF NOT EXISTS idx_events_status   ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_platform ON public.events(is_platform_event);

-- =====================================================
-- PART 2: PROFILE EXTENSIONS FOR PLUG N' PLAY
-- =====================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS x_handle TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_handle TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS builders_hub_signed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS builders_hub_handle TEXT;

-- =====================================================
-- PART 3: QUEST SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quests (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  emoji        TEXT NOT NULL DEFAULT '🎯',
  category     TEXT NOT NULL DEFAULT 'social' CHECK (category IN ('social','community','wallet','builders_hub')),
  evidence_kind TEXT NOT NULL DEFAULT 'url' CHECK (evidence_kind IN ('url','wallet','handle','code','none')),
  placeholder  TEXT NOT NULL DEFAULT '',
  xp_reward    INTEGER NOT NULL DEFAULT 20,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quests viewable by everyone" ON public.quests FOR SELECT USING (true);
CREATE POLICY "Admins manage quests" ON public.quests FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.quest_submissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id   TEXT NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  evidence   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id UUID,
  rejection_reason TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (user_id, quest_id)
);
ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own quest subs; admins see all"
  ON public.quest_submissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users insert their own quest sub"
  ON public.quest_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update quest subs"
  ON public.quest_submissions FOR UPDATE
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.submit_quest(_quest_id TEXT, _evidence TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.quest_submissions (user_id, quest_id, evidence, status)
  VALUES (_uid, _quest_id, COALESCE(_evidence,''), 'pending')
  ON CONFLICT (user_id, quest_id)
  DO UPDATE SET evidence = EXCLUDED.evidence, status = 'pending', reviewed_at = NULL, reviewer_id = NULL, rejection_reason = NULL
  RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_quest TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_quest_submission(_submission_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _xp INTEGER; _uid UUID; _existing_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT q.xp_reward, s.user_id, s.status INTO _xp, _uid, _existing_status
    FROM public.quest_submissions s
    JOIN public.quests q ON q.id = s.quest_id
   WHERE s.id = _submission_id;
  IF _uid IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _existing_status = 'approved' THEN RETURN; END IF;
  UPDATE public.quest_submissions
     SET status='approved', xp_awarded=_xp, reviewer_id=auth.uid(), reviewed_at=now(), rejection_reason=NULL
   WHERE id = _submission_id;
  UPDATE public.profiles SET xp = xp + _xp WHERE user_id = _uid;
END $$;
GRANT EXECUTE ON FUNCTION public.approve_quest_submission TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_quest_submission(_submission_id UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.quest_submissions
     SET status='rejected', reviewer_id=auth.uid(), reviewed_at=now(), rejection_reason=_reason, xp_awarded=0
   WHERE id = _submission_id;
END $$;
GRANT EXECUTE ON FUNCTION public.reject_quest_submission TO authenticated;

-- =====================================================
-- PART 4: UNIFIED LEADERBOARD + REWARD PAYOUTS
-- =====================================================
CREATE OR REPLACE VIEW public.unified_leaderboard AS
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

CREATE TABLE IF NOT EXISTS public.reward_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID,
  user_id      UUID NOT NULL,
  username     TEXT NOT NULL,
  rank         INTEGER NOT NULL,
  amount_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
  wallet_address TEXT,
  sent         BOOLEAN NOT NULL DEFAULT false,
  tx_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ
);
ALTER TABLE public.reward_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payouts viewable by everyone" ON public.reward_payouts FOR SELECT USING (true);
CREATE POLICY "Admins manage payouts" ON public.reward_payouts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.finalize_event_leaderboard(_event_id UUID, _pool NUMERIC DEFAULT 100)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row RECORD; _share NUMERIC; _amount NUMERIC; _count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  -- Wipe prior payouts for this event
  DELETE FROM public.reward_payouts WHERE event_id = _event_id;
  _share := GREATEST(0, _pool - 80) / 7.0; -- top 4-10 share remainder of pool ($20 of $100 default)
  FOR _row IN
    SELECT user_id, username, wallet_address, total_xp, rank
      FROM public.unified_leaderboard
     WHERE total_xp > 0
     ORDER BY rank ASC
     LIMIT 10
  LOOP
    _count := _count + 1;
    _amount := CASE _row.rank
                 WHEN 1 THEN ROUND(_pool * 0.40, 2)
                 WHEN 2 THEN ROUND(_pool * 0.25, 2)
                 WHEN 3 THEN ROUND(_pool * 0.15, 2)
                 ELSE ROUND(_share, 2)
               END;
    INSERT INTO public.reward_payouts (event_id, user_id, username, rank, amount_usd, wallet_address)
    VALUES (_event_id, _row.user_id, _row.username, _row.rank, _amount, _row.wallet_address);
  END LOOP;
  RETURN _count;
END $$;
GRANT EXECUTE ON FUNCTION public.finalize_event_leaderboard TO authenticated;

-- =====================================================
-- PART 5: 7-DAY POST-EVENT TASK LOOP
-- =====================================================
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id          TEXT PRIMARY KEY,
  day_index   INTEGER NOT NULL UNIQUE CHECK (day_index BETWEEN 1 AND 7),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji       TEXT NOT NULL DEFAULT '⭐',
  xp_reward   INTEGER NOT NULL DEFAULT 25,
  cta_label   TEXT NOT NULL DEFAULT 'Mark complete',
  cta_url     TEXT
);
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily tasks viewable by everyone" ON public.daily_tasks FOR SELECT USING (true);
CREATE POLICY "Admins manage daily tasks" ON public.daily_tasks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.user_daily_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      TEXT NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);
ALTER TABLE public.user_daily_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own progress" ON public.user_daily_progress FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users insert own progress" ON public.user_daily_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.complete_daily_task(_task_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _xp INTEGER; _new INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT xp_reward INTO _xp FROM public.daily_tasks WHERE id = _task_id;
  IF _xp IS NULL THEN RAISE EXCEPTION 'Unknown task'; END IF;
  INSERT INTO public.user_daily_progress (user_id, task_id) VALUES (_uid, _task_id)
    ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET xp = xp + _xp, streak = streak + 1 WHERE user_id = _uid
    RETURNING xp INTO _new;
  RETURN jsonb_build_object('xp_earned', _xp, 'new_xp', _new);
END $$;
GRANT EXECUTE ON FUNCTION public.complete_daily_task TO authenticated;

-- Seed quests
INSERT INTO public.quests (id, title, description, emoji, category, evidence_kind, placeholder, xp_reward, sort_order) VALUES
  ('follow-x',         'Follow @AvaxAfrica on X',                      'Follow the official Avalanche Africa account on X (Twitter).',                  '𝕏', 'social',       'handle', '@yourhandle',                                                     30, 1),
  ('quote-pinned',     'Quote the pinned tweet',                       'Quote-tweet the pinned post on @AvaxAfrica and paste the tweet URL below.',      '💬', 'social',       'url',    'https://x.com/...',                                              30, 2),
  ('join-community',   'Join Telegram or WhatsApp',                    'Join the Avalanche Africa Telegram OR WhatsApp group, then paste your handle.', '💬', 'community',    'handle', '@yourtelegram or +254...',                                       20, 3),
  ('post-unique-code', 'Post your unique code',                        'Post the unique code shown to you (e.g. "GM AVAX-1234") in the community.',     '🔑', 'community',    'code',   'GM AVAX-1234',                                                   20, 4),
  ('core-wallet',      'Download Core Wallet & paste your address',    'Install the Core wallet, create an account, and paste your wallet address.',    '🦊', 'wallet',       'wallet', '0x...',                                                          30, 5),
  ('builders-hub',     'Sign up to Avalanche Builders Hub',             'Create an account on the Avalanche Builders Hub and submit your username.',     '🏗️', 'builders_hub','handle', 'builders.avax.network/yourname',                                 50, 6)
ON CONFLICT (id) DO NOTHING;

-- Seed daily tasks (7-day loop)
INSERT INTO public.daily_tasks (id, day_index, title, description, emoji, xp_reward, cta_label, cta_url) VALUES
  ('day1-open-wallet', 1, 'Open your wallet',           'Sign in to Core and check your balance on Fuji.',           '👛', 25, 'I opened it',         NULL),
  ('day2-make-tx',     2, 'Make a transaction',         'Send 0.01 AVAX on Fuji to anyone (even yourself).',         '⚡', 30, 'I did it',            'https://faucet.avax.network/'),
  ('day3-explore-dapp',3, 'Explore an Avalanche dApp',  'Visit Trader Joe, Pangolin, or any Avalanche dApp.',        '🧭', 25, 'Explored',            'https://core.app/discover'),
  ('day4-submit-idea', 4, 'Submit a builder idea',      'Share one app idea you would build on Avalanche.',          '💡', 35, 'I shared',            NULL),
  ('day5-share-story', 5, 'Share your story',           'Post a tweet about your Avalanche journey.',                '📣', 25, 'I posted',            NULL),
  ('day6-return',      6, 'Come back & check rank',     'Return to Plug n'' Play and check the leaderboard.',        '🔁', 20, 'I came back',         NULL),
  ('day7-recap',       7, 'Recap your week',            'Pick one thing you learned and tag @AvaxAfrica.',           '🎬', 40, 'Done',                NULL)
ON CONFLICT (id) DO NOTHING;
