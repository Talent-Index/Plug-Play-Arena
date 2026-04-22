// Extended types for tables added after the initial auto-generated types.ts
// Run `supabase gen types typescript` to regenerate the full types file.

export interface GameRow {
  id: string
  title: string
  persona: string
  category: string
  difficulty: string
  themes: string[]
  description: string
  learning_outcome: string
  emoji: string
  duration: string
  xp_reward: number
  reward_type: string
  event_types: string[]
  status: string
  created_at: string
}

export interface ChallengeRow {
  id: string
  slug: string
  title: string
  tagline: string
  emoji: string
  accent: string
  tier: string
  ai_ready: boolean
  est_minutes: number
  xp_reward: number
  badge_title: string
  concept: string
  brief: string
  steps: ChallengeStepRow[]
  build_prompt: string
  ai_prompt: string | null
  submission: ChallengeSubmissionShape
  verification: ChallengeVerificationShape
  created_at: string
}

export interface ChallengeStepRow {
  title: string
  detail: string
  hint?: string
}

export interface ChallengeSubmissionShape {
  primary: { key: string; label: string; kind: string; placeholder: string; helpText?: string }
  extras?: { key: string; label: string; kind: string; placeholder: string }[]
}

export interface ChallengeVerificationShape {
  kind: string
  rules: string[]
}

// Expanded events row (after migration 20260422000001)
export interface EventRow {
  id: string
  host_user_id: string | null
  title: string
  description: string | null
  format: string
  location: string | null
  starts_at: string | null
  ends_at: string | null
  status: string
  current_round_id: string | null
  leaderboard_visible: boolean
  reward_pool: string | null
  cover_emoji: string | null
  category: string | null
  zoom_url: string | null
  tracks: string[] | null
  difficulty: string | null
  agenda: AgendaItem[] | null
  missions: string[] | null
  capacity: number | null
  is_platform_event: boolean | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
}

export interface AgendaItem {
  time: string
  title: string
}

export interface AdminStats {
  total_users: number
  total_missions: number
  total_xp: number
  total_nft_mints: number
  active_events: number
  arena_sessions: number
  pending_subs: number
  total_challenges: number
}
