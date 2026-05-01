-- AvalancheArena: rooms, players, events, results
CREATE TABLE public.arena_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  host_user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'chain_builder',
  status text NOT NULL DEFAULT 'lobby',
  max_players integer NOT NULL DEFAULT 4,
  event_mode boolean NOT NULL DEFAULT false,
  turn_seconds integer NOT NULL DEFAULT 30,
  actions_per_turn integer NOT NULL DEFAULT 2,
  max_rounds integer NOT NULL DEFAULT 10,
  current_round integer NOT NULL DEFAULT 0,
  current_player_id uuid,
  actions_remaining integer NOT NULL DEFAULT 2,
  turn_started_at timestamptz,
  board jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.arena_room_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.arena_rooms(id) ON DELETE CASCADE,
  user_id uuid,
  nickname text NOT NULL,
  emoji text NOT NULL DEFAULT '🔺',
  chain_color text NOT NULL DEFAULT '#FF394A',
  seat integer NOT NULL,
  is_ready boolean NOT NULL DEFAULT false,
  is_bot boolean NOT NULL DEFAULT false,
  arena_tokens integer NOT NULL DEFAULT 100,
  energy integer NOT NULL DEFAULT 50,
  validators integer NOT NULL DEFAULT 2,
  chain_health integer NOT NULL DEFAULT 100,
  warriors jsonb NOT NULL DEFAULT '[]'::jsonb,
  territories integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat)
);

CREATE TABLE public.arena_room_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.arena_rooms(id) ON DELETE CASCADE,
  player_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.arena_match_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.arena_rooms(id) ON DELETE CASCADE,
  mode text NOT NULL,
  winner_player_id uuid,
  winner_nickname text,
  winner_user_id uuid,
  standings jsonb NOT NULL DEFAULT '[]'::jsonb,
  concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  arena_distributed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_rooms_status ON public.arena_rooms(status);
CREATE INDEX idx_arena_rooms_code ON public.arena_rooms(code);
CREATE INDEX idx_arena_room_players_room ON public.arena_room_players(room_id);
CREATE INDEX idx_arena_room_events_room ON public.arena_room_events(room_id, created_at DESC);

ALTER TABLE public.arena_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_match_results ENABLE ROW LEVEL SECURITY;

-- arena_rooms
CREATE POLICY "Rooms viewable by everyone" ON public.arena_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated can create rooms" ON public.arena_rooms FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "Host can update own rooms" ON public.arena_rooms FOR UPDATE
  USING (auth.uid() = host_user_id);
CREATE POLICY "Host can delete own rooms" ON public.arena_rooms FOR DELETE
  USING (auth.uid() = host_user_id);

-- arena_room_players
CREATE POLICY "Room players viewable by everyone" ON public.arena_room_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join a room" ON public.arena_room_players FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid()
              OR EXISTS (SELECT 1 FROM public.arena_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid()));
CREATE POLICY "Self or host updates player row" ON public.arena_room_players FOR UPDATE
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.arena_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid()));
CREATE POLICY "Host can remove players" ON public.arena_room_players FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.arena_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid()));

-- arena_room_events
CREATE POLICY "Room events viewable by everyone" ON public.arena_room_events FOR SELECT USING (true);
CREATE POLICY "Players or host can append events" ON public.arena_room_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.arena_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.arena_room_players p WHERE p.id = player_id AND p.user_id = auth.uid())
  );

-- arena_match_results
CREATE POLICY "Results viewable by everyone" ON public.arena_match_results FOR SELECT USING (true);
CREATE POLICY "Host can record results" ON public.arena_match_results FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid()));

CREATE TRIGGER arena_rooms_updated BEFORE UPDATE ON public.arena_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_room_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_match_results;

ALTER TABLE public.arena_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.arena_room_players REPLICA IDENTITY FULL;