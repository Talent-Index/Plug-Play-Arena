-- =====================================================
-- PLUG N' PLAY ARENA — Neon PostgreSQL Setup Script
-- Run with: psql 'postgresql://neondb_owner:...' -f neon_setup.sql
--
-- Differences from Supabase version:
--   • auth.uid() reads from SET LOCAL app.current_user_id = '<uuid>'
--   • public.users replaces auth.users (owns the email/password)
--   • No supabase_realtime publications (use polling or your own pub/sub)
--   • anon + authenticated roles are created here
-- =====================================================

-- ── 0. Roles ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- Grant authenticated role usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── 1. Auth Shim ────────────────────────────────────────────────────────
-- Your API routes must run:  SET LOCAL app.current_user_id = '<uuid>';
-- before any query that relies on the caller identity.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID
$$;

-- Users table (owns authentication — replaces auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  email_confirmed_at  TIMESTAMPTZ,
  raw_user_meta_data  JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own record"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- ── 2. Enums ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.persona AS ENUM ('student','developer','builder','founder','business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('draft','live','paused','ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.round_status AS ENUM ('pending','active','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attempt_status AS ENUM ('in_progress','completed','failed','timeout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_kind AS ENUM ('wallet','tx_hash','contract','github','json','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Tables ────────────────────────────────────────────────────────────

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  username       TEXT NOT NULL,
  emoji          TEXT NOT NULL DEFAULT '🔺',
  persona        public.persona NOT NULL DEFAULT 'student',
  wallet_address TEXT,
  xp             INTEGER NOT NULL DEFAULT 0,
  level          INTEGER NOT NULL DEFAULT 1,
  stage          TEXT NOT NULL DEFAULT 'explorer',
  streak         INTEGER NOT NULL DEFAULT 0,
  status_tag     TEXT,
  is_admin       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id        UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  format              TEXT NOT NULL DEFAULT 'irl',
  location            TEXT,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  status              public.event_status NOT NULL DEFAULT 'draft',
  current_round_id    UUID,
  leaderboard_visible BOOLEAN NOT NULL DEFAULT true,
  reward_pool         TEXT,
  cover_emoji         TEXT DEFAULT '⚡',
  category            TEXT DEFAULT 'community',
  zoom_url            TEXT,
  tracks              TEXT[] DEFAULT '{}',
  difficulty          TEXT DEFAULT 'beginner',
  agenda              JSONB DEFAULT '[]',
  missions            TEXT[] DEFAULT '{}',
  capacity            INTEGER DEFAULT 100,
  is_platform_event   BOOLEAN DEFAULT false,
  cover_image_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their events"
  ON public.events FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can delete their events"
  ON public.events FOR DELETE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Admins manage all events"
  ON public.events FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  persona    public.persona NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, persona)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Hosts can manage teams for their events"
  ON public.teams FOR ALL
  USING (public.is_event_host(event_id))
  WITH CHECK (public.is_event_host(event_id));

-- EVENT PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.event_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_score INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants viewable by everyone" ON public.event_participants FOR SELECT USING (true);
CREATE POLICY "Users can check themselves in"
  ON public.event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own participation; hosts update any"
  ON public.event_participants FOR UPDATE
  USING (auth.uid() = user_id OR public.is_event_host(event_id));

-- ROUNDS
CREATE TABLE IF NOT EXISTS public.rounds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  game_id            TEXT NOT NULL,
  round_number       INTEGER NOT NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 300,
  status             public.round_status NOT NULL DEFAULT 'pending',
  started_at         TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rounds viewable by everyone" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Hosts manage rounds for their events"
  ON public.rounds FOR ALL
  USING (public.is_event_host(event_id))
  WITH CHECK (public.is_event_host(event_id));

-- MISSION ATTEMPTS
CREATE TABLE IF NOT EXISTS public.mission_attempts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id               UUID REFERENCES public.events(id) ON DELETE SET NULL,
  round_id               UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  game_id                TEXT NOT NULL,
  status                 public.attempt_status NOT NULL DEFAULT 'in_progress',
  score                  INTEGER NOT NULL DEFAULT 0,
  speed_bonus            INTEGER NOT NULL DEFAULT 0,
  accuracy_pct           INTEGER NOT NULL DEFAULT 0,
  difficulty_multiplier  NUMERIC NOT NULL DEFAULT 1.0,
  attempts_used          INTEGER NOT NULL DEFAULT 1,
  perfect_run            BOOLEAN NOT NULL DEFAULT false,
  fast_finisher          BOOLEAN NOT NULL DEFAULT false,
  duration_ms            INTEGER,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at           TIMESTAMPTZ
);

ALTER TABLE public.mission_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own attempts; hosts see attempts for their events"
  ON public.mission_attempts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (event_id IS NOT NULL AND public.is_event_host(event_id))
  );

-- BROADCASTS
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'announcement',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Broadcasts viewable by everyone" ON public.broadcasts FOR SELECT USING (true);
CREATE POLICY "Hosts can broadcast"
  ON public.broadcasts FOR INSERT WITH CHECK (public.is_event_host(event_id));

-- ACTIVITY FEED
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  username   TEXT,
  emoji      TEXT,
  message    TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'mission',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity viewable by everyone" ON public.activity_feed FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post their own activity"
  ON public.activity_feed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- NFT BADGES
CREATE TABLE IF NOT EXISTS public.nft_badges (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id  UUID REFERENCES public.events(id) ON DELETE SET NULL,
  game_id   TEXT,
  title     TEXT NOT NULL,
  rarity    TEXT NOT NULL DEFAULT 'common',
  emoji     TEXT DEFAULT '🏅',
  minted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nft_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges viewable by everyone" ON public.nft_badges FOR SELECT USING (true);

-- REWARDS
CREATE TABLE IF NOT EXISTS public.rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  kind        TEXT NOT NULL DEFAULT 'digital',
  rarity      TEXT NOT NULL DEFAULT 'common',
  value       TEXT,
  claimed     BOOLEAN NOT NULL DEFAULT false,
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own rewards" ON public.rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own rewards" ON public.rewards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Block direct inserts on rewards"
  ON public.rewards FOR INSERT TO authenticated WITH CHECK (false);

-- APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App settings viewable by everyone" ON public.app_settings FOR SELECT USING (true);

-- CHALLENGE SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenge_id     TEXT NOT NULL,
  event_id         UUID REFERENCES public.events(id) ON DELETE SET NULL,
  round_id         UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  attempt_id       UUID REFERENCES public.mission_attempts(id) ON DELETE SET NULL,
  kind             public.submission_kind NOT NULL,
  payload          JSONB NOT NULL,
  status           public.submission_status NOT NULL DEFAULT 'pending',
  evidence         JSONB,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at      TIMESTAMPTZ
);

ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own submissions; hosts see event submissions"
  ON public.challenge_submissions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (event_id IS NOT NULL AND public.is_event_host(event_id))
  );

-- NFT MINTS (on-chain Fuji mints)
CREATE TABLE IF NOT EXISTS public.nft_mints (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenge_id       TEXT NOT NULL,
  game_id            TEXT,
  event_id           UUID REFERENCES public.events(id) ON DELETE SET NULL,
  contract_address   TEXT NOT NULL,
  token_id           TEXT NOT NULL,
  recipient_address  TEXT NOT NULL,
  tx_hash            TEXT NOT NULL UNIQUE,
  network            TEXT NOT NULL DEFAULT 'fuji',
  metadata_uri       TEXT,
  metadata           JSONB,
  minted_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nft_mints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NFT mints viewable by everyone" ON public.nft_mints FOR SELECT USING (true);

-- GAMES CATALOG
CREATE TABLE IF NOT EXISTS public.games (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  persona          TEXT NOT NULL,
  category         TEXT NOT NULL,
  difficulty       TEXT NOT NULL DEFAULT 'beginner',
  themes           TEXT[] NOT NULL DEFAULT '{}',
  description      TEXT NOT NULL DEFAULT '',
  learning_outcome TEXT NOT NULL DEFAULT '',
  emoji            TEXT NOT NULL DEFAULT '🎮',
  duration         TEXT NOT NULL DEFAULT '5 min',
  xp_reward        INTEGER NOT NULL DEFAULT 100,
  reward_type      TEXT NOT NULL DEFAULT 'xp' CHECK (reward_type IN ('xp','nft','merch','token')),
  event_types      TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','soon')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
CREATE POLICY "Admins manage games"
  ON public.games FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- CHALLENGES CATALOG
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
CREATE POLICY "Challenges viewable by everyone" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Admins manage challenges"
  ON public.challenges FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ARENA: GAME SESSIONS
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','live','finished')),
  join_code              TEXT NOT NULL UNIQUE,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  question_started_at    TIMESTAMPTZ,
  winner_player_id       UUID,
  winner_claimed_at      TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions viewable by everyone" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Host can create sessions"
  ON public.game_sessions FOR INSERT WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "Host can update own sessions"
  ON public.game_sessions FOR UPDATE USING (auth.uid() = host_user_id);

-- ARENA: PLAYERS
CREATE TABLE IF NOT EXISTS public.arena_players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  nickname       TEXT NOT NULL,
  wallet_address TEXT,
  score          INTEGER NOT NULL DEFAULT 0,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Arena players viewable by everyone" ON public.arena_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join (guest or authed)"
  ON public.arena_players FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Score updates by host"
  ON public.arena_players FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.host_user_id = auth.uid())
    OR auth.uid() = user_id
  );

-- ARENA: QUESTIONS
CREATE TABLE IF NOT EXISTS public.arena_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic           TEXT NOT NULL DEFAULT 'stablecoins',
  question_text   TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_answer  TEXT NOT NULL,
  difficulty      TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard'))
);

ALTER TABLE public.arena_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions viewable by everyone" ON public.arena_questions FOR SELECT USING (true);

-- ARENA: ANSWERS
CREATE TABLE IF NOT EXISTS public.arena_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id        UUID NOT NULL REFERENCES public.arena_players(id) ON DELETE CASCADE,
  question_id      UUID NOT NULL REFERENCES public.arena_questions(id),
  selected_answer  TEXT NOT NULL,
  is_correct       BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Answers viewable by session participants" ON public.arena_answers FOR SELECT USING (true);

-- ARENA: RESULTS
CREATE TABLE IF NOT EXISTS public.arena_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  winner_player_id UUID NOT NULL REFERENCES public.arena_players(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  wallet_address   TEXT,
  nickname         TEXT NOT NULL,
  score            INTEGER NOT NULL DEFAULT 0,
  nft_tx_hash      TEXT,
  nft_token_id     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

ALTER TABLE public.arena_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Arena results viewable by everyone" ON public.arena_results FOR SELECT USING (true);
CREATE POLICY "Host can record winner"
  ON public.arena_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = arena_results.session_id AND s.host_user_id = auth.uid()
  ));
CREATE POLICY "Host can update winner record"
  ON public.arena_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = arena_results.session_id AND s.host_user_id = auth.uid()
  ));

-- ── 4. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attempts_user       ON public.mission_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_event      ON public.mission_attempts(event_id);
CREATE INDEX IF NOT EXISTS idx_attempts_round      ON public.mission_attempts(round_id);
CREATE INDEX IF NOT EXISTS idx_participants_event  ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_rounds_event        ON public.rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_activity_event      ON public.activity_feed(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_event    ON public.broadcasts(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_xp         ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_nfts_user           ON public.nft_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_user           ON public.challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_event          ON public.challenge_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_subs_challenge      ON public.challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_mints_user          ON public.nft_mints(user_id);
CREATE INDEX IF NOT EXISTS idx_mints_challenge     ON public.nft_mints(challenge_id);
CREATE INDEX IF NOT EXISTS idx_games_persona       ON public.games(persona);
CREATE INDEX IF NOT EXISTS idx_games_status        ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_challenges_slug     ON public.challenges(slug);
CREATE INDEX IF NOT EXISTS idx_events_status       ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_platform     ON public.events(is_platform_event);

-- ── 5. Triggers ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_events_updated
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile when a user registers (on public.users insert)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, emoji, persona)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'emoji', '🔺'),
    COALESCE((NEW.raw_user_meta_data ->> 'persona')::public.persona, 'student')
  );
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Freeze immutable reward fields
CREATE OR REPLACE FUNCTION public.protect_reward_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.title       IS DISTINCT FROM OLD.title       OR
     NEW.description IS DISTINCT FROM OLD.description OR
     NEW.kind        IS DISTINCT FROM OLD.kind        OR
     NEW.rarity      IS DISTINCT FROM OLD.rarity      OR
     NEW.value       IS DISTINCT FROM OLD.value       OR
     NEW.event_id    IS DISTINCT FROM OLD.event_id    OR
     NEW.user_id     IS DISTINCT FROM OLD.user_id     THEN
    RAISE EXCEPTION 'Reward fields are immutable; only claimed/claimed_at may change';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_rewards_protect
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.protect_reward_fields();

-- ── 6. Helper Functions ────────────────────────────────────────────────────

-- is_admin: true when the calling user has is_admin = true on their profile
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE user_id = auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon, authenticated;

-- is_event_host: true when the calling user is the host of the given event
CREATE OR REPLACE FUNCTION public.is_event_host(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id AND host_user_id = auth.uid()
  );
$$;

-- get_my_profile: returns the caller's full profile (including wallet)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile TO authenticated;

-- get_leaderboard: public, no wallet exposed
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  _limit INTEGER DEFAULT 50,
  _persona public.persona DEFAULT NULL
)
RETURNS TABLE (
  user_id    UUID,
  username   TEXT,
  emoji      TEXT,
  persona    public.persona,
  xp         INTEGER,
  level      INTEGER,
  stage      TEXT,
  streak     INTEGER,
  status_tag TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, username, emoji, persona, xp, level, stage, streak, status_tag
  FROM public.profiles
  WHERE _persona IS NULL OR persona = _persona
  ORDER BY xp DESC
  LIMIT GREATEST(1, LEAST(200, _limit));
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon, authenticated;

-- get_public_profile: single profile without wallet
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id UUID)
RETURNS TABLE (
  user_id UUID, username TEXT, emoji TEXT, persona public.persona,
  xp INTEGER, level INTEGER, stage TEXT, streak INTEGER, status_tag TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, username, emoji, persona, xp, level, stage, streak, status_tag
  FROM public.profiles WHERE user_id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile TO anon, authenticated;

-- get_event_leaderboard: event-scoped scores
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(_event_id UUID)
RETURNS TABLE (
  user_id           UUID,
  username          TEXT,
  emoji             TEXT,
  persona           public.persona,
  team_id           UUID,
  team_name         TEXT,
  team_color        TEXT,
  event_score       INTEGER,
  attempts_completed INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id, pr.username, pr.emoji, pr.persona,
    t.id, t.name, t.color,
    p.event_score,
    (SELECT COUNT(*)::INTEGER FROM public.mission_attempts a
       WHERE a.user_id = p.user_id AND a.event_id = _event_id AND a.status = 'completed')
  FROM public.event_participants p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  LEFT JOIN public.teams t ON t.id = p.team_id
  WHERE p.event_id = _event_id
  ORDER BY p.event_score DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard TO anon, authenticated;

-- submit_attempt: server-side scoring (SECURITY DEFINER — no direct INSERT allowed)
CREATE OR REPLACE FUNCTION public.submit_attempt(
  _game_id TEXT,
  _event_id UUID,
  _round_id UUID,
  _accuracy_pct INTEGER,
  _duration_ms INTEGER,
  _difficulty_multiplier NUMERIC,
  _attempts_used INTEGER,
  _time_limit_seconds INTEGER,
  _xp_reward INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _accuracy INTEGER := GREATEST(0, LEAST(100, COALESCE(_accuracy_pct, 0)));
  _multiplier NUMERIC := GREATEST(0.5, LEAST(3.0, COALESCE(_difficulty_multiplier, 1.0)));
  _retry_penalty NUMERIC := GREATEST(0.5, 1.0 - (GREATEST(_attempts_used, 1) - 1) * 0.15);
  _speed_ratio NUMERIC := 0;
  _speed_bonus INTEGER := 0;
  _base_score INTEGER := 0;
  _final_score INTEGER := 0;
  _perfect BOOLEAN := false;
  _fast BOOLEAN := false;
  _attempt_id UUID;
  _new_xp INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _time_limit_seconds > 0 AND _duration_ms IS NOT NULL THEN
    _speed_ratio := 1.0 - LEAST(1.0, (_duration_ms::NUMERIC / 1000.0) / _time_limit_seconds::NUMERIC);
    _speed_bonus := GREATEST(0, FLOOR(_speed_ratio * 200))::INTEGER;
  END IF;

  _base_score := FLOOR(_accuracy * 5 + _speed_bonus)::INTEGER;
  _final_score := FLOOR(_base_score * _multiplier * _retry_penalty)::INTEGER;
  _perfect := (_accuracy = 100 AND _attempts_used = 1);
  _fast := (_speed_ratio >= 0.5);

  IF _perfect THEN _final_score := _final_score + 100; END IF;
  IF _fast THEN _final_score := _final_score + 50; END IF;

  INSERT INTO public.mission_attempts (
    user_id, event_id, round_id, game_id, status,
    score, speed_bonus, accuracy_pct, difficulty_multiplier,
    attempts_used, perfect_run, fast_finisher, duration_ms, completed_at
  ) VALUES (
    _uid, _event_id, _round_id, _game_id, 'completed',
    _final_score, _speed_bonus, _accuracy, _multiplier,
    _attempts_used, _perfect, _fast, _duration_ms, now()
  ) RETURNING id INTO _attempt_id;

  UPDATE public.profiles
    SET xp = xp + _xp_reward,
        level = 1 + ((xp + _xp_reward) / 500),
        stage = CASE
          WHEN xp + _xp_reward >= 4000 THEN 'champion'
          WHEN xp + _xp_reward >= 2200 THEN 'founder'
          WHEN xp + _xp_reward >= 1200 THEN 'architect'
          WHEN xp + _xp_reward >= 600  THEN 'builder'
          WHEN xp + _xp_reward >= 200  THEN 'learner'
          ELSE 'explorer'
        END,
        updated_at = now()
    WHERE user_id = _uid
  RETURNING xp INTO _new_xp;

  IF _event_id IS NOT NULL THEN
    UPDATE public.event_participants
      SET event_score = event_score + _final_score
      WHERE event_id = _event_id AND user_id = _uid;

    UPDATE public.teams t
      SET score = score + _final_score
      FROM public.event_participants p
      WHERE p.event_id = _event_id
        AND p.user_id = _uid
        AND p.team_id = t.id;
  END IF;

  INSERT INTO public.activity_feed (event_id, user_id, username, emoji, message, kind)
  SELECT _event_id, _uid, p.username, p.emoji,
    p.username || ' scored ' || _final_score || ' on ' || _game_id ||
    CASE WHEN _perfect THEN ' · PERFECT RUN' WHEN _fast THEN ' · FAST FINISH' ELSE '' END,
    'mission_complete'
  FROM public.profiles p WHERE p.user_id = _uid;

  RETURN jsonb_build_object(
    'attempt_id', _attempt_id,
    'score', _final_score,
    'speed_bonus', _speed_bonus,
    'accuracy', _accuracy,
    'perfect', _perfect,
    'fast', _fast,
    'xp_earned', _xp_reward,
    'new_xp', _new_xp
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_attempt TO authenticated;

-- mint_badge
CREATE OR REPLACE FUNCTION public.mint_badge(
  _attempt_id UUID,
  _title TEXT,
  _rarity TEXT,
  _emoji TEXT,
  _game_id TEXT,
  _event_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _ok BOOLEAN;
  _badge_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mission_attempts
    WHERE id = _attempt_id AND user_id = _uid AND status = 'completed'
  ) INTO _ok;

  IF NOT _ok THEN RAISE EXCEPTION 'Invalid attempt'; END IF;

  INSERT INTO public.nft_badges (user_id, event_id, game_id, title, rarity, emoji)
  VALUES (_uid, _event_id, _game_id, _title,
    CASE WHEN _rarity IN ('common','rare','legendary') THEN _rarity ELSE 'common' END,
    COALESCE(_emoji, '🏅'))
  RETURNING id INTO _badge_id;

  RETURN _badge_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.mint_badge TO authenticated;

-- issue_reward
CREATE OR REPLACE FUNCTION public.issue_reward(
  _attempt_id UUID,
  _title TEXT,
  _description TEXT,
  _kind TEXT,
  _rarity TEXT,
  _value TEXT,
  _event_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _ok BOOLEAN;
  _r_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mission_attempts
    WHERE id = _attempt_id AND user_id = _uid AND status = 'completed'
  ) INTO _ok;

  IF NOT _ok THEN RAISE EXCEPTION 'Invalid attempt'; END IF;

  INSERT INTO public.rewards (user_id, event_id, title, description, kind, rarity, value)
  VALUES (_uid, _event_id, _title, _description,
    CASE WHEN _kind IN ('digital','physical','token','merch','perk','mentorship','nft') THEN _kind ELSE 'digital' END,
    CASE WHEN _rarity IN ('common','rare','legendary') THEN _rarity ELSE 'common' END,
    _value)
  RETURNING id INTO _r_id;

  RETURN _r_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.issue_reward TO authenticated;

-- record_submission
CREATE OR REPLACE FUNCTION public.record_submission(
  _challenge_id TEXT,
  _kind public.submission_kind,
  _payload JSONB,
  _event_id UUID,
  _round_id UUID,
  _attempt_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payload';
  END IF;
  INSERT INTO public.challenge_submissions
    (user_id, challenge_id, kind, payload, event_id, round_id, attempt_id)
  VALUES (_uid, _challenge_id, _kind, _payload, _event_id, _round_id, _attempt_id)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_submission TO authenticated;

-- mark_submission_verified (called by server-side edge/API function)
CREATE OR REPLACE FUNCTION public.mark_submission_verified(
  _submission_id UUID,
  _evidence JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.challenge_submissions
    SET status = 'verified',
        evidence = COALESCE(_evidence, '{}'::jsonb),
        verified_at = now()
    WHERE id = _submission_id;
END $$;

-- mark_submission_rejected
CREATE OR REPLACE FUNCTION public.mark_submission_rejected(
  _submission_id UUID,
  _reason TEXT,
  _evidence JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.challenge_submissions
    SET status = 'rejected',
        rejection_reason = _reason,
        evidence = COALESCE(_evidence, '{}'::jsonb)
    WHERE id = _submission_id;
END $$;

-- record_nft_mint (called by server-side minting service)
CREATE OR REPLACE FUNCTION public.record_nft_mint(
  _user_id UUID,
  _challenge_id TEXT,
  _event_id UUID,
  _contract_address TEXT,
  _token_id TEXT,
  _recipient_address TEXT,
  _tx_hash TEXT,
  _metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.nft_mints
    (user_id, challenge_id, event_id, contract_address, token_id,
     recipient_address, tx_hash, metadata)
  VALUES
    (_user_id, _challenge_id, _event_id, _contract_address, _token_id,
     _recipient_address, _tx_hash, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- get_app_setting / set_app_setting
CREATE OR REPLACE FUNCTION public.get_app_setting(_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT value FROM public.app_settings WHERE key = _key $$;

CREATE OR REPLACE FUNCTION public.set_app_setting(_key TEXT, _value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_settings(key, value)
  VALUES (_key, _value)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
END $$;

-- get_admin_stats
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_users',      (SELECT COUNT(*) FROM public.profiles),
    'total_missions',   (SELECT COUNT(*) FROM public.mission_attempts WHERE status = 'completed'),
    'total_xp',         (SELECT COALESCE(SUM(xp), 0) FROM public.profiles),
    'total_nft_mints',  (SELECT COUNT(*) FROM public.nft_mints),
    'active_events',    (SELECT COUNT(*) FROM public.events WHERE status IN ('live','draft')),
    'arena_sessions',   (SELECT COUNT(*) FROM public.game_sessions),
    'pending_subs',     (SELECT COUNT(*) FROM public.challenge_submissions WHERE status = 'pending'),
    'total_challenges', (SELECT COUNT(*) FROM public.challenge_submissions WHERE status = 'verified')
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_admin_stats TO authenticated;

-- arena_submit_answer: atomic answer + score bump
CREATE OR REPLACE FUNCTION public.arena_submit_answer(
  _session_id UUID,
  _player_id UUID,
  _question_id UUID,
  _selected_answer TEXT,
  _response_time_ms INTEGER
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _correct TEXT;
  _is_correct BOOLEAN;
  _points INTEGER := 0;
  _new_score INTEGER;
  _exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM arena_players WHERE id = _player_id AND session_id = _session_id
  ) INTO _exists;
  IF NOT _exists THEN RAISE EXCEPTION 'Invalid player'; END IF;

  IF EXISTS (
    SELECT 1 FROM arena_answers WHERE player_id = _player_id AND question_id = _question_id
  ) THEN
    RAISE EXCEPTION 'Already answered';
  END IF;

  SELECT correct_answer INTO _correct FROM arena_questions WHERE id = _question_id;
  _is_correct := (_selected_answer = _correct);

  IF _is_correct THEN
    _points := GREATEST(0, 1000 - (COALESCE(_response_time_ms, 0) / 10));
  END IF;

  INSERT INTO arena_answers(session_id, player_id, question_id, selected_answer, is_correct, response_time_ms)
  VALUES (_session_id, _player_id, _question_id, _selected_answer, _is_correct, COALESCE(_response_time_ms, 0));

  UPDATE arena_players
    SET score = score + _points
    WHERE id = _player_id
    RETURNING score INTO _new_score;

  RETURN jsonb_build_object(
    'is_correct', _is_correct,
    'points', _points,
    'score', _new_score,
    'correct_answer', _correct
  );
END $$;

-- arena_attach_wallet: guest wallet attachment
CREATE OR REPLACE FUNCTION public.arena_attach_wallet(_player_id UUID, _wallet TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _wallet IS NULL OR _wallet !~ '^0x[a-fA-F0-9]{40}$' THEN
    RAISE EXCEPTION 'Invalid wallet address';
  END IF;
  UPDATE arena_players SET wallet_address = _wallet WHERE id = _player_id;
END $$;

-- ── 7. Grant table access to roles ────────────────────────────────────────
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── 8. Seed Data ──────────────────────────────────────────────────────────

-- Games (38 games)
INSERT INTO public.games (id, title, persona, category, difficulty, themes, description, learning_outcome, emoji, duration, xp_reward, reward_type, event_types, status) VALUES
('av-explorer-quiz',  'Avalanche Explorer Quiz',   'student', 'Quiz',           'Beginner',     ARRAY['Avalanche Basics'],              'Speed-quiz on Avalanche fundamentals: history, mission, and architecture at a glance.', 'Understand what makes Avalanche unique.',   '🏔️', '4 min',  80,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('consensus-quest',   'Consensus Quest',           'student', 'Mission Quest',  'Beginner',     ARRAY['Consensus'],                     'Travel through the Snowman protocol — vote, sample, and reach finality.',                'Grasp Avalanche consensus visually.',       '❄️', '6 min', 120,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('wallet-setup',      'Wallet Setup Challenge',    'student', 'Mission Quest',  'Beginner',     ARRAY['Wallets','Testnet'],              'Create a Core wallet, fund it on Fuji, and complete your first transaction.',             'Onboard onto Avalanche in <5 min.',         '👛', '5 min', 100,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('avax-basics-rush',  'AVAX Basics Rush',          'student', 'Trivia',         'Beginner',     ARRAY['Avalanche Basics','Tokenomics'],  'Rapid-fire trivia on AVAX, gas, validators, and staking.',                              'Know the AVAX token economy.',              '⚡', '3 min',  70,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('subnet-discovery',  'Subnet Discovery Game',     'student', 'Puzzle',         'Beginner',     ARRAY['Subnets'],                       'Match real Avalanche subnets to their use cases.',                                     'Recognise the subnet landscape.',           '🧩', '5 min',  90,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('blockchain-bingo',  'Blockchain Bingo',          'student', 'Team Challenge', 'Beginner',     ARRAY['Avalanche Basics'],              'Live bingo with Avalanche terms — first to call out a row wins.',                      'Build vocabulary through play.',            '🎱', '8 min', 100,  'merch', ARRAY['IRL','Hybrid'],        'live'),
('eco-scavenger',     'Ecosystem Scavenger Hunt',  'student', 'Mission Quest',  'Beginner',     ARRAY['Ecosystem Growth'],              'Find QR clues across the venue tied to Avalanche projects.',                            'Map the live ecosystem.',                   '🗺️', '20 min',200,  'merch', ARRAY['IRL'],                 'live'),
('smart-contract-sprint', 'Smart Contract Sprint',           'developer', 'Build Challenge', 'Intermediate', ARRAY['Smart Contracts','Testnet'],    'Write, compile, and deploy a Solidity contract on Fuji in record time.',                'Ship your first contract live.',            '🏁', '15 min',250,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('av-fundamentals',       'Avalanche Fundamentals Challenge','developer', 'Quiz',            'Intermediate', ARRAY['Avalanche Basics','Consensus'], 'Deep-dive quiz: X-Chain vs C-Chain vs P-Chain, Snowman++, gas dynamics.',               'Master Avalanche architecture.',            '📐', '8 min', 180,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('subnet-builder-sim',    'Subnet Builder Simulator',        'developer', 'Simulation',      'Advanced',     ARRAY['Subnets'],                      'Configure a custom subnet — validators, VM, gas token — and launch in sandbox.',        'Design production-ready subnets.',          '🧪', '20 min',320,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('bridge-the-chain',      'Bridge the Chain Puzzle',         'developer', 'Puzzle',          'Intermediate', ARRAY['Bridges'],                      'Route assets across chains using Avalanche Warp Messaging primitives.',                  'Understand cross-chain messaging.',         '🌉', '10 min',200,  'xp',    ARRAY['Zoom','Hybrid'],       'live'),
('debug-the-contract',    'Debug the Contract',              'developer', 'Puzzle',          'Intermediate', ARRAY['Smart Contracts'],              'Find the bug in a Solidity contract before the timer ends.',                            'Sharpen contract review skills.',           '🐛', '7 min', 160,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('deploy-on-fuji',        'Deploy on Fuji',                  'developer', 'Mission Quest',   'Beginner',     ARRAY['Testnet','Smart Contracts'],    'Guided mission to deploy your first contract on the Fuji testnet.',                    'Learn the Fuji deploy pipeline.',           '🚧', '10 min',180,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('testnet-mission',       'Testnet Mission Mode',            'developer', 'Build Challenge', 'Advanced',     ARRAY['Testnet','Smart Contracts'],    'Complete 5 progressive mission stages on testnet.',                                    'End-to-end dApp shipping.',                 '🎯', '30 min',400,  'nft',   ARRAY['IRL','Hybrid'],        'soon'),
('vm-architect',          'VM Architect Challenge',          'developer', 'Decision Game',   'Advanced',     ARRAY['Subnets'],                      'Design choices for a custom VM — pick consensus, fee model, finality.',                 'Reason about VM trade-offs.',               '🧠', '12 min',260,  'xp',    ARRAY['Zoom','Hybrid'],       'soon'),
('eco-builder-sim',     'Ecosystem Builder Sim',         'builder', 'Simulation',      'Intermediate', ARRAY['Ecosystem Growth'],              'Run a 4-quarter simulation of growing a subnet ecosystem.',                             'Strategic ecosystem thinking.',             '🌐', '15 min',280,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('tokenomics-tycoon',   'Tokenomics Tycoon',             'builder', 'Simulation',      'Advanced',     ARRAY['Tokenomics'],                    'Design and stress-test a token economy under live market events.',                     'Ship sustainable tokenomics.',              '💱', '18 min',320,  'xp',    ARRAY['Zoom','Hybrid'],       'live'),
('launch-strategy',     'Launch Strategy Challenge',     'builder', 'Decision Game',   'Intermediate', ARRAY['Launch & Adoption'],             'Sequence the right launch moves — testnet, audit, marketing, liquidity.',               'Plan a credible launch.',                   '🚦', '10 min',200,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('subnet-design-lab',   'Subnet Design Lab',             'builder', 'Build Challenge', 'Advanced',     ARRAY['Subnets'],                       'Architect a domain-specific subnet for gaming, RWA, or DeFi.',                          'Translate use case to architecture.',        '🧬', '20 min',340,  'nft',   ARRAY['IRL','Hybrid'],        'soon'),
('pmf-quest',           'Product-Market Fit Quest',      'builder', 'Mission Quest',   'Intermediate', ARRAY['Launch & Adoption'],             'Run discovery sprints with simulated user segments.',                                  'Diagnose PMF signals.',                     '🎯', '12 min',220,  'xp',    ARRAY['Zoom','Hybrid'],       'live'),
('scale-the-stack',     'Scale the Stack Simulation',    'builder', 'Simulation',      'Advanced',     ARRAY['Ecosystem Growth'],              'Solve scaling bottlenecks across infra, app, and community layers.',                    'Think in systems.',                         '📈', '18 min',300,  'xp',    ARRAY['Zoom','Hybrid'],       'soon'),
('community-growth',    'Community Growth Builder',      'builder', 'Decision Game',   'Beginner',     ARRAY['Community'],                     'Choose tactics to grow an authentic Avalanche community.',                              'Avoid mercenary growth.',                   '👥', '8 min', 160,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('build-for-adoption',  'Build for Adoption',            'builder', 'Case Study',      'Intermediate', ARRAY['Launch & Adoption','Community'], 'Study real Avalanche launches and replay key decisions.',                               'Pattern-match real adoption stories.',      '📚', '15 min',240,  'nft',   ARRAY['Zoom','Hybrid'],       'soon'),
('founder-fit',        'Founder Fit Challenge',        'founder', 'Quiz',           'Beginner',     ARRAY['Launch & Adoption'],              'Assess your founder–market–chain fit on Avalanche.',                                    'Know where you stand.',                     '🧭', '6 min', 140,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('gtm-arena',          'Go-To-Market Arena',           'founder', 'Decision Game',   'Intermediate', ARRAY['Launch & Adoption'],              'Pick your wedge, channels, and partners under time pressure.',                          'Build a defensible GTM.',                   '⚔️', '12 min',240,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('pitch-deck-boss',    'Pitch Deck Boss Fight',         'founder', 'Mission Quest',   'Intermediate', ARRAY['Launch & Adoption'],              'Refine 8 deck slides under live investor critique.',                                   'A deck that closes meetings.',              '🎤', '15 min',280,  'merch', ARRAY['IRL','Hybrid'],        'live'),
('community-flywheel', 'Community Flywheel Quest',      'founder', 'Simulation',      'Intermediate', ARRAY['Community'],                      'Design loops that compound community value.',                                          'Engineer retention loops.',                 '🔁', '10 min',200,  'xp',    ARRAY['Zoom','Hybrid'],       'live'),
('fundraising-sim',    'Fundraising Simulation',        'founder', 'Simulation',      'Advanced',     ARRAY['Tokenomics','Launch & Adoption'], 'Run a fundraise — terms, dilution, runway, follow-ons.',                               'Negotiate from strength.',                  '💼', '20 min',360,  'nft',   ARRAY['Zoom','Hybrid'],       'soon'),
('eco-partnership',    'Ecosystem Partnership Game',    'founder', 'Team Challenge',  'Intermediate', ARRAY['Ecosystem Growth'],               'Negotiate a partnership across two Avalanche subnets.',                                'Structure value-aligned deals.',            '🤝', '12 min',240,  'xp',    ARRAY['IRL','Hybrid'],        'live'),
('startup-decision',   'Startup Decision Lab',          'founder', 'Decision Game',   'Beginner',     ARRAY['Launch & Adoption'],              'Navigate a year of founder decisions with real consequences.',                          'Reason under uncertainty.',                 '🧪', '10 min',200,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('av-founder-path',    'Avalanche Founder Path',        'founder', 'Mission Quest',   'Intermediate', ARRAY['Ecosystem Growth','Launch & Adoption'],'Multi-stage journey from idea → grant → launch on Avalanche.',                     'See the full founder pathway.',             '🛤️', '25 min',400,  'nft',   ARRAY['Hybrid'],              'soon'),
('enterprise-integration', 'Enterprise Integration Challenge', 'business', 'Build Challenge', 'Advanced',     ARRAY['Business Use Cases'],                       'Connect a legacy system to an Avalanche subnet with audit-ready flows.',                'Integrate with confidence.',                '🏗️', '20 min',320,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('web3-business-sim',      'Web3 Business Simulation',         'business', 'Simulation',      'Intermediate', ARRAY['Business Use Cases'],                       'Operate a Web3 business across 4 quarters with shifting market events.',                'Run a sustainable Web3 business.',         '🏢', '18 min',300,  'xp',    ARRAY['Zoom','Hybrid'],       'live'),
('loyalty-system',         'Loyalty System Builder',           'business', 'Build Challenge', 'Intermediate', ARRAY['Business Use Cases','NFTs'],                'Design an on-chain loyalty program with tiered NFT rewards.',                           'Translate loyalty to chain.',              '🎁', '15 min',260,  'nft',   ARRAY['IRL','Zoom','Hybrid'], 'live'),
('treasury-rewards',       'Treasury & Rewards Strategy',      'business', 'Decision Game',   'Advanced',     ARRAY['Tokenomics','Business Use Cases'],           'Allocate treasury to liquidity, ops, and rewards under risk constraints.',              'Allocate with discipline.',                '🏦', '12 min',240,  'xp',    ARRAY['Zoom','Hybrid'],       'live'),
('customer-activation',    'Customer Activation Game',         'business', 'Mission Quest',   'Intermediate', ARRAY['Community','Business Use Cases'],            'Design a customer onboarding flow that turns visitors into wallets.',                   'Ship Web3 onboarding that converts.',      '🎯', '12 min',240,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('onchain-ops-lab',        'Onchain Operations Lab',           'business', 'Simulation',      'Advanced',     ARRAY['Business Use Cases'],                       'Run finance, payroll, and reporting on-chain with simulated audits.',                   'Operate transparently on-chain.',          '⚙️', '20 min',320,  'nft',   ARRAY['Zoom','Hybrid'],       'soon'),
('business-explorer',      'Business Model Explorer',          'business', 'Decision Game',   'Beginner',     ARRAY['Business Use Cases'],                       'Match real Avalanche use cases to revenue models.',                                    'Spot fitting use cases.',                  '🔭', '8 min', 160,  'xp',    ARRAY['IRL','Zoom','Hybrid'], 'live'),
('av-use-case-sprint',     'Avalanche Use Case Sprint',        'business', 'Team Challenge',  'Intermediate', ARRAY['Business Use Cases','Launch & Adoption'],   'Team sprint to design a working Avalanche pilot for your industry.',                   'Walk away with a real plan.',              '🏃', '25 min',360,  'merch', ARRAY['IRL','Hybrid'],        'live')
ON CONFLICT (id) DO NOTHING;

-- Challenges (7 speedrun challenges)
INSERT INTO public.challenges (id, slug, title, tagline, emoji, accent, tier, ai_ready, est_minutes, xp_reward, badge_title, concept, brief, steps, build_prompt, ai_prompt, submission, verification) VALUES

('fuji-wallet', 'fuji-wallet', 'Fuji Wallet Quest',
 'Spin up a Core wallet, fund it from the faucet, and prove you own it.',
 '🦊', 'cyan', 'Beginner', false, 10, 250, 'Fuji Initiate',
 'Self-custody on Avalanche: how a wallet, the Fuji testnet, and the faucet fit together.',
 'You''ve just been hired as the on-chain ops lead at a small DAO. Before you touch real money, the team needs you to prove you can operate a wallet on Avalanche''s Fuji testnet — fund it, hold it, sign with it.',
 '[{"title":"Install Core or use MetaMask","detail":"Install Core wallet (core.app) or add Avalanche Fuji to MetaMask.","hint":"Fuji RPC: https://api.avax-test.network/ext/bc/C/rpc · Chain ID 43113"},{"title":"Switch to Fuji Testnet","detail":"Select the Fuji C-Chain network inside your wallet."},{"title":"Claim AVAX from the faucet","detail":"Visit faucet.avax.network and request testnet AVAX to your address."},{"title":"Confirm balance > 0","detail":"Open snowtrace.io/?chainid=43113 and paste your address — you should see incoming AVAX."},{"title":"Submit your address","detail":"Paste your full 0x… address below to claim your Fuji Initiate badge."}]',
 'Get a working Fuji wallet with non-zero AVAX balance.',
 NULL,
 '{"primary":{"key":"wallet_address","label":"Your Fuji wallet address","kind":"wallet","placeholder":"0x…","helpText":"Must be a valid EVM address (0x + 40 hex chars)."}}',
 '{"kind":"wallet","rules":["EVM address format (0x + 40 hex)","Address has Fuji balance ≥ 0 AVAX (proves it exists on chain)"]}'
),

('first-tx', 'first-tx', 'Your First Fuji Transaction',
 'Send AVAX, get the tx hash, and watch the network confirm it live.',
 '⚡', 'lime', 'Beginner', false, 8, 300, 'First Mover',
 'How an EVM transaction works: from, to, value, gas, hash, confirmation.',
 'Your DAO is moving stipend payments to Avalanche. Prove the basics: you can construct, sign, and broadcast a Fuji transaction — and verify it landed.',
 '[{"title":"Open your funded Fuji wallet","detail":"Use the address you registered in the Fuji Wallet Quest."},{"title":"Send 0.01 AVAX to any Fuji address","detail":"You can send back to yourself — the goal is producing a real tx.","hint":"Try a burn address like 0x000000000000000000000000000000000000dEaD"},{"title":"Copy the transaction hash","detail":"After confirmation, your wallet shows a 0x… tx hash. Copy it."},{"title":"Verify on Snowtrace","detail":"Paste the hash into testnet.snowtrace.io to confirm \"Success\"."},{"title":"Submit the tx hash","detail":"Paste the hash below — we re-check it directly against Fuji RPC."}]',
 'Broadcast one successful Fuji transaction and submit its hash.',
 NULL,
 '{"primary":{"key":"tx_hash","label":"Fuji transaction hash","kind":"tx_hash","placeholder":"0x…","helpText":"64 hex chars after 0x."}}',
 '{"kind":"tx_hash","rules":["Hash format (0x + 64 hex)","Transaction exists on Fuji","Receipt status = success"]}'
),

('erc20-launch', 'erc20-launch', 'Launch Your Token',
 'Deploy an ERC-20 to Fuji and submit the contract address.',
 '🪙', 'gold', 'Intermediate', true, 25, 700, 'Token Launcher',
 'ERC-20 anatomy: name, symbol, totalSupply, transfer, balanceOf — and how to deploy one to Fuji.',
 'Your community wants a meme-coin reward token for event participation. Ship a real ERC-20 on Fuji that the team can later mint, distribute, and audit.',
 '[{"title":"Open Remix IDE","detail":"remix.ethereum.org — no install required."},{"title":"Drop in an ERC-20","detail":"Use the OpenZeppelin ERC20 template. Pick a name, symbol, and initial supply."},{"title":"Compile with Solidity 0.8.x","detail":"Make sure compilation passes with no errors."},{"title":"Connect wallet → Fuji","detail":"In Remix \"Deploy & Run\", choose Injected Provider (MetaMask/Core) on chain 43113."},{"title":"Deploy","detail":"Confirm the tx. Copy the deployed contract address."},{"title":"Submit the contract address","detail":"Paste below — we check Fuji RPC for deployed bytecode."}]',
 'Deploy a working ERC-20 to Fuji and submit its contract address.',
 'Generate a minimal OpenZeppelin-based ERC-20 in Solidity 0.8.20 with constructor params (name, symbol, initialSupply) that mints initialSupply to msg.sender. Include SPDX license and pragma.',
 '{"primary":{"key":"contract_address","label":"Deployed ERC-20 contract address","kind":"contract","placeholder":"0x…","helpText":"Address must have deployed bytecode on Fuji."}}',
 '{"kind":"contract","rules":["Address format (0x + 40 hex)","eth_getCode returns non-empty bytecode on Fuji"]}'
),

('nft-mint', 'nft-mint', 'Mint Your First NFT',
 'Deploy an ERC-721 on Fuji and mint token #1 to your wallet.',
 '🖼️', 'magenta', 'Intermediate', true, 30, 800, 'NFT Architect',
 'ERC-721: tokenURI, ownerOf, mint — and how off-chain metadata maps to on-chain ownership.',
 'An artist friend wants to drop a 1-of-1 on Avalanche before her gallery show. You''re shipping the contract, minting #1 to her wallet, and proving it on Snowtrace.',
 '[{"title":"Write or scaffold an ERC-721","detail":"Use OpenZeppelin ERC721 + Ownable in Remix or Hardhat."},{"title":"Deploy to Fuji","detail":"Same flow as the ERC-20 challenge — Injected Provider, chain 43113."},{"title":"Mint token #1 to your wallet","detail":"Call safeMint(yourAddress, \"ipfs://…\") or your own tokenURI."},{"title":"Grab the mint tx hash","detail":"From your wallet activity or Snowtrace."},{"title":"Submit contract + tx hash","detail":"Both get verified against Fuji RPC."}]',
 'Deploy an ERC-721 on Fuji and mint at least one token.',
 'Write a minimal OpenZeppelin-based ERC-721 in Solidity 0.8.20 with: name "AvaArt", symbol "AVART", a public safeMint(address to, string tokenURI) restricted to the owner, and a counter for tokenIds. Include SPDX + pragma.',
 '{"primary":{"key":"contract_address","label":"NFT contract address","kind":"contract","placeholder":"0x…"},"extras":[{"key":"mint_tx_hash","label":"Mint transaction hash","kind":"tx_hash","placeholder":"0x…"}]}',
 '{"kind":"contract","rules":["Contract has bytecode on Fuji","Mint tx hash exists on Fuji","Tx status = success"]}'
),

('subnet-blueprint', 'subnet-blueprint', 'Subnet Blueprint',
 'Design a custom Avalanche L1 in JSON — validators, gas token, governance.',
 '🧩', 'sky', 'Advanced', true, 20, 900, 'Subnet Architect',
 'Why teams launch Avalanche L1s: sovereign gas tokens, validator sets, custom rules.',
 'A gaming studio wants their own Avalanche L1 so in-game gas is paid in their token, not AVAX. Draft the configuration that an ops team could hand to avalanche-cli.',
 '[{"title":"Pick a name and chain ID","detail":"Choose something memorable. Chain ID must not collide with mainnet ranges."},{"title":"Pick a gas token","detail":"Symbol, decimals, and an initial allocation map."},{"title":"Define validator set","detail":"How many validators at launch? Stake requirements?"},{"title":"Choose governance model","detail":"Foundation-led, multisig, or DAO?"},{"title":"Submit your spec as JSON","detail":"Single JSON object with: name, chainId, gasToken, validators, governance."}]',
 'Submit a JSON spec for a custom Avalanche L1.',
 'Draft a JSON config for a custom Avalanche L1 for a gaming project. Required keys: name (string), chainId (int), gasToken { symbol, decimals, initialAllocation: { address: amount } }, validators { count, minStake }, governance ("foundation"|"multisig"|"dao"). Output JSON only — no commentary.',
 '{"primary":{"key":"spec_json","label":"Subnet config JSON","kind":"json","placeholder":"{ \"name\": \"MyChain\", \"chainId\": 4242, … }","helpText":"Must be valid JSON with required keys."}}',
 '{"kind":"json","rules":["Parses as JSON object","Has keys: name, chainId, gasToken, validators, governance","chainId is a positive integer"]}'
),

('avausd-peg', 'avausd-peg', 'AvaUSD: Keep the Peg',
 'Design, defend, and stabilize a decentralized stablecoin on Avalanche.',
 '🏦', 'cyan', 'Advanced', true, 45, 1500, 'Peg Defender',
 'Stablecoins rely on collateral, interest rates, and liquidation mechanics to maintain a $1 peg. You''ll experience the trilemma firsthand.',
 'You are launching AvaUSD on Avalanche. Your mission: maintain a stable $1 peg under volatile market conditions. Mint, manage rates, survive a 30% crash, and prove your system holds.',
 '[{"title":"Deposit collateral","detail":"Add AVAX-backed collateral to secure your system."},{"title":"Mint AvaUSD","detail":"Generate stablecoins while keeping a safe collateral ratio (≥ 150%)."},{"title":"Adjust interest rates","detail":"Balance supply and demand using borrow/savings rates."},{"title":"Survive a market crash","detail":"Trigger the −30% AVAX shock and watch your peg slip."},{"title":"Restore the peg","detail":"Bring AvaUSD back to $1 ± 0.02 with health ≥ 120%.","hint":"Repay debt, liquidate, or hike the savings rate."},{"title":"Submit final state","detail":"Click \"Capture state\" below to lock in your defended system."}]',
 'Operate the AvaUSD simulator and prove the peg survives a market crash.',
 'Explain three concrete actions a stablecoin protocol can take to defend its peg after a 30% collateral price drop. Output as a numbered list, max 60 words total.',
 '{"primary":{"key":"final_state","label":"Final stablecoin state","kind":"custom","placeholder":"Auto-filled when you capture state","helpText":"Captured automatically from the simulator above."}}',
 '{"kind":"custom","rules":["peg between 0.98 and 1.02","health ≥ 120","collateral ratio ≥ 150","market crash was triggered"]}'
),

('dapp-github', 'dapp-github', 'Ship a Fuji dApp',
 'Build a frontend that reads from your Fuji contract and ship the repo.',
 '🚀', 'pink', 'Advanced', true, 60, 1200, 'Avalanche Builder',
 'End-to-end Web3: contract on Fuji, ethers/viem in the browser, wallet connection, live reads.',
 'A founder wants a public demo page for her token before she pitches investors. Ship a one-page dApp that connects a wallet, reads totalSupply from her Fuji ERC-20, and renders it.',
 '[{"title":"Pick a contract","detail":"Use the ERC-20 you deployed in the Token Launch challenge — or any Fuji contract."},{"title":"Scaffold a frontend","detail":"Vite + React + ethers (or viem). Lovable can scaffold this."},{"title":"Wire wallet connect","detail":"Use window.ethereum / wagmi to connect to Fuji."},{"title":"Read on-chain data","detail":"Call totalSupply() or balanceOf() and render it on the page."},{"title":"Push to a public GitHub repo","detail":"Make sure the repo is public and the README mentions Fuji."},{"title":"Submit the repo URL + contract","detail":"We check the repo exists via GitHub API and the contract has bytecode on Fuji."}]',
 'Ship a Fuji-connected dApp on GitHub.',
 'Generate a minimal Vite + React + ethers v6 single-page app that: 1) shows a Connect Wallet button, 2) requests Avalanche Fuji (chainId 43113) network switch, 3) reads totalSupply() from an ERC-20 contract address (env var), 4) renders the formatted supply. One file App.jsx + main.jsx.',
 '{"primary":{"key":"github_url","label":"Public GitHub repo URL","kind":"github","placeholder":"https://github.com/you/your-repo"},"extras":[{"key":"contract_address","label":"Contract the dApp reads from","kind":"contract","placeholder":"0x…"}]}',
 '{"kind":"github","rules":["URL matches https://github.com/{owner}/{repo}","Repo is public (GitHub API responds 200)","Contract has bytecode on Fuji"]}'
)

ON CONFLICT (id) DO NOTHING;

-- Arena Quiz Questions (25 questions)
INSERT INTO public.arena_questions (topic, question_text, options, correct_answer, difficulty) VALUES
('avalanche_basics', 'What consensus mechanism does Avalanche use?', '{"A":"Proof of Work","B":"Delegated Proof of Stake","C":"Snowman (Avalanche consensus)","D":"Byzantine Fault Tolerance"}', 'C', 'easy'),
('avalanche_basics', 'What is the native token of the Avalanche network?', '{"A":"ETH","B":"AVAX","C":"AVA","D":"ALC"}', 'B', 'easy'),
('avalanche_basics', 'Which chain handles smart contract execution on Avalanche mainnet?', '{"A":"X-Chain","B":"P-Chain","C":"C-Chain","D":"D-Chain"}', 'C', 'easy'),
('avalanche_basics', 'What does the P-Chain on Avalanche primarily manage?', '{"A":"Token transfers","B":"Smart contracts","C":"Validators and subnets","D":"Cross-chain bridges"}', 'C', 'medium'),
('avalanche_basics', 'Approximately how many transactions per second can Avalanche finalize?', '{"A":"7 TPS","B":"15 TPS","C":"4,500 TPS","D":"1,000,000 TPS"}', 'C', 'medium'),
('avalanche_basics', 'What is the finality time of Avalanche transactions?', '{"A":"~60 seconds","B":"~1 second","C":"~10 minutes","D":"~5 minutes"}', 'B', 'easy'),
('avalanche_basics', 'What is the Fuji testnet used for?', '{"A":"Running production DeFi protocols","B":"Mining AVAX","C":"Testing and development before mainnet deployment","D":"Storing P-Chain validator records"}', 'C', 'easy'),
('avalanche_basics', 'What is an Avalanche L1 (formerly Subnet)?', '{"A":"A layer-1 competing chain","B":"A sovereign blockchain with its own rules and validators","C":"A sidechain that mirrors Ethereum","D":"A validator pool on the C-Chain"}', 'B', 'medium'),
('stablecoins', 'What is a stablecoin?', '{"A":"A coin with very low price volatility targeting a fixed value","B":"A coin that earns staking rewards","C":"A governance token for DeFi protocols","D":"A token that tracks the price of gold"}', 'A', 'easy'),
('stablecoins', 'What does "collateral ratio" mean in a stablecoin system?', '{"A":"The ratio of stablecoin holders to borrowers","B":"The value of collateral backing each unit of stablecoin issued","C":"The percentage of rewards paid to validators","D":"The inflation rate of the stablecoin"}', 'B', 'medium'),
('stablecoins', 'What happens during a liquidation in a collateralized stablecoin?', '{"A":"The user gets extra stablecoins","B":"Under-collateralized positions are closed to protect the peg","C":"Validators receive extra rewards","D":"The stablecoin supply is increased"}', 'B', 'medium'),
('stablecoins', 'If AVAX drops 30% and your collateral ratio falls below the minimum, what should you do to avoid liquidation?', '{"A":"Wait for the price to recover","B":"Add more collateral or repay some stablecoin debt","C":"Withdraw all collateral immediately","D":"Mint more stablecoins"}', 'B', 'hard'),
('stablecoins', 'What is the peg of USDC?', '{"A":"1 BTC","B":"1 ETH","C":"1 USD","D":"1 AVAX"}', 'C', 'easy'),
('stablecoins', 'Which mechanism helps a savings rate RAISE demand for a stablecoin?', '{"A":"Inflating supply","B":"Reducing interest rates","C":"Offering yield to holders, incentivising holding over selling","D":"Burning the treasury"}', 'C', 'hard'),
('stablecoins', 'In a decentralized stablecoin, who sets the stability parameters?', '{"A":"A single company CEO","B":"Only miners","C":"Governance token holders via on-chain votes","D":"Government regulators"}', 'C', 'medium'),
('defi', 'What does TVL stand for in DeFi?', '{"A":"Total Value Locked","B":"Token Velocity Limit","C":"Trusted Validator Layer","D":"Transaction Verification Ledger"}', 'A', 'easy'),
('defi', 'What is an AMM (Automated Market Maker)?', '{"A":"A bot that mines tokens","B":"A protocol that prices assets using a mathematical formula instead of an order book","C":"An exchange run by a company","D":"A staking validator node"}', 'B', 'medium'),
('defi', 'What is impermanent loss in a liquidity pool?', '{"A":"Transaction fees paid to validators","B":"The loss from a smart contract hack","C":"The opportunity cost vs. holding assets outside the pool due to price divergence","D":"Gas costs for swapping tokens"}', 'C', 'hard'),
('defi', 'What does "yield farming" refer to?', '{"A":"Growing tokens in a virtual farm game","B":"Moving assets across protocols to maximise returns","C":"Validating blocks for block rewards","D":"Creating new DeFi protocols"}', 'B', 'medium'),
('subnets', 'Which of these is a real Avalanche L1 in production?', '{"A":"Solana Subnet","B":"Dexalot","C":"Ethereum Subnet","D":"Polygon L2"}', 'B', 'hard'),
('subnets', 'What is the key advantage of an Avalanche L1 over deploying on the C-Chain?', '{"A":"Cheaper AVAX staking","B":"Sovereign gas token, custom rules, and dedicated validators","C":"Faster finality than C-Chain","D":"No smart contract support needed"}', 'B', 'medium'),
('subnets', 'What tool does Avalanche provide for launching a new L1 from the command line?', '{"A":"eth-cli","B":"hardhat","C":"avalanche-cli","D":"subnet-forge"}', 'C', 'medium'),
('nfts', 'What does ERC-721 define?', '{"A":"A fungible token standard","B":"A non-fungible token standard with unique IDs","C":"A governance protocol","D":"A cross-chain bridge standard"}', 'B', 'easy'),
('nfts', 'What is a tokenURI in an ERC-721 contract?', '{"A":"The wallet address of the token owner","B":"A link to the token''s metadata (image, attributes, description)","C":"The gas price for minting","D":"The contract owner''s private key"}', 'B', 'medium'),
('nfts', 'On Avalanche Fuji testnet, what is the chain ID?', '{"A":"1","B":"137","C":"43114","D":"43113"}', 'D', 'medium')
ON CONFLICT DO NOTHING;

-- Platform Events (7 events)
INSERT INTO public.events (
  title, description, format, location, status,
  category, zoom_url, tracks, difficulty, reward_pool,
  cover_emoji, agenda, missions, capacity, starts_at, ends_at,
  is_platform_event, leaderboard_visible
) VALUES
(
  'Nairobi Blockchain Week — Avalanche Day',
  'A full day inside the Avalanche ecosystem at NBW — workshops, missions, and a live leaderboard.',
  'irl', 'Sarit Expo, Nairobi', 'live',
  'Conference', NULL,
  ARRAY['student','developer','founder','business'],
  'intermediate', '$5,000 + Merch + NFTs', '⚡',
  '[{"time":"09:00","title":"Check-in & Wallet Setup Mission"},{"time":"10:00","title":"Avalanche Fundamentals Live Quiz"},{"time":"12:00","title":"Subnet Builder Hands-on"},{"time":"15:00","title":"Founder Pitch Boss Fight"},{"time":"17:00","title":"NFT Mint & Awards"}]',
  ARRAY['wallet-setup','av-explorer-quiz','subnet-builder-sim','pitch-deck-boss'],
  600, now() - interval '1 day', now() + interval '2 days', true, true
),
(
  'Avalanche Dev Session #7 — Subnets in 60',
  'Live Zoom session: spin up a subnet, deploy a precompile, and ship to Fuji.',
  'zoom', 'Virtual', 'draft',
  'Builder Workshop', 'https://zoom.us/j/avalanche',
  ARRAY['developer','builder'],
  'advanced', 'NFT Badge + 0.5 AVAX top performer', '🖥️',
  '[{"time":"17:00","title":"Welcome & Check-in"},{"time":"17:10","title":"Subnet Builder Sim (live)"},{"time":"18:00","title":"Deploy on Fuji mission"},{"time":"18:45","title":"Q&A + NFT mint"}]',
  ARRAY['subnet-builder-sim','deploy-on-fuji','smart-contract-sprint'],
  200, now() + interval '5 days', now() + interval '5 days' + interval '3 hours', true, true
),
(
  'Strathmore Campus Activation',
  'Hands-on Avalanche onboarding for students — wallet setup, scavenger hunt, dev sprint.',
  'hybrid', 'Strathmore University, Nairobi', 'draft',
  'Campus Event', 'https://zoom.us/j/campus',
  ARRAY['student','developer'],
  'beginner', 'Merch packs + Genesis NFT for top 25', '🎓',
  '[{"time":"10:00","title":"Wallet Setup + Bingo"},{"time":"11:30","title":"Ecosystem Scavenger Hunt"},{"time":"14:00","title":"Smart Contract Sprint"},{"time":"16:00","title":"NFT mint + photos"}]',
  ARRAY['wallet-setup','blockchain-bingo','eco-scavenger','smart-contract-sprint'],
  250, now() + interval '12 days', now() + interval '12 days' + interval '5 hours', true, true
),
(
  'Founder Roundtable — Lagos',
  'Closed-door session with Avalanche founders. Pitch, fundraise, partner.',
  'irl', 'Lekki, Lagos', 'draft',
  'Founder Session', NULL,
  ARRAY['founder','business'],
  'intermediate', 'Mentor intros + Pitch slot + NFT', '🚀',
  '[{"time":"14:00","title":"Founder Fit Challenge"},{"time":"15:00","title":"GTM Arena (live)"},{"time":"16:30","title":"Pitch Deck Boss Fight"}]',
  ARRAY['founder-fit','gtm-arena','pitch-deck-boss','eco-partnership'],
  40, now() + interval '25 days', now() + interval '25 days' + interval '4 hours', true, true
),
(
  'Kigali Avalanche Hackathon',
  '48-hour hackathon to ship subnets, dApps, and AI×Avalanche experiences.',
  'irl', 'Norrsken House, Kigali', 'draft',
  'Hackathon', NULL,
  ARRAY['developer','builder','founder'],
  'advanced', '$15,000 + Subnet credits + NFTs', '⚔️',
  '[{"time":"Day 1 09:00","title":"Opening + Team Formation"},{"time":"Day 1 12:00","title":"Subnet Builder Workshop"},{"time":"Day 2 09:00","title":"Build Sprint"},{"time":"Day 3 14:00","title":"Demos + NFT mint"}]',
  ARRAY['subnet-builder-sim','smart-contract-sprint','launch-strategy','pitch-deck-boss'],
  300, now() + interval '40 days', now() + interval '42 days', true, true
),
(
  'Avalanche for Business — Q2 Briefing',
  'Executive briefing for enterprises evaluating Avalanche subnets and tokenisation.',
  'zoom', 'Virtual', 'ended',
  'Conference', 'https://zoom.us/j/business',
  ARRAY['business','founder'],
  'beginner', 'Briefing NFT + Pilot intro', '🏢',
  '[{"time":"15:00","title":"Avalanche for Enterprise"},{"time":"15:45","title":"Use Case Sprint"}]',
  ARRAY['enterprise-integration','av-use-case-sprint','business-explorer'],
  500, now() - interval '30 days', now() - interval '30 days' + interval '2 hours', true, true
),
(
  'Avalanche Community Meetup — Dar',
  'Casual meetup, lightning talks, and live missions.',
  'irl', 'Mlimani City, Dar es Salaam', 'ended',
  'Community Meetup', NULL,
  ARRAY['student','developer','builder'],
  'beginner', 'Merch + Participation NFT', '🌍',
  '[{"time":"18:00","title":"Lightning talks"},{"time":"19:00","title":"Live missions + Bingo"}]',
  ARRAY['av-explorer-quiz','blockchain-bingo','community-growth'],
  150, now() - interval '60 days', now() - interval '60 days' + interval '4 hours', true, true
)
ON CONFLICT DO NOTHING;

-- ── 9. Grant table-level DML to authenticated (applied retroactively) ─────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── DONE ──────────────────────────────────────────────────────────────────
-- Run with:
--   psql 'postgresql://neondb_owner:npg_O1zqDdIL8UVm@ep-restless-glitter-ansb1lvn-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f neon_setup.sql
