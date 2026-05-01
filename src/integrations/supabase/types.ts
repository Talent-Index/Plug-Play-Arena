export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          created_at: string
          emoji: string | null
          event_id: string | null
          id: string
          kind: string
          message: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          message: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          emoji?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          message?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      arena_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          player_id: string
          question_id: string
          response_time_ms: number
          selected_answer: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          player_id: string
          question_id: string
          response_time_ms?: number
          selected_answer: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          player_id?: string
          question_id?: string
          response_time_ms?: number
          selected_answer?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "arena_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "arena_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_match_results: {
        Row: {
          arena_distributed: number
          concepts: Json
          created_at: string
          id: string
          mode: string
          room_id: string
          standings: Json
          winner_nickname: string | null
          winner_player_id: string | null
          winner_user_id: string | null
        }
        Insert: {
          arena_distributed?: number
          concepts?: Json
          created_at?: string
          id?: string
          mode: string
          room_id: string
          standings?: Json
          winner_nickname?: string | null
          winner_player_id?: string | null
          winner_user_id?: string | null
        }
        Update: {
          arena_distributed?: number
          concepts?: Json
          created_at?: string
          id?: string
          mode?: string
          room_id?: string
          standings?: Json
          winner_nickname?: string | null
          winner_player_id?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_match_results_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "arena_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_players: {
        Row: {
          id: string
          joined_at: string
          nickname: string
          score: number
          session_id: string
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          id?: string
          joined_at?: string
          nickname: string
          score?: number
          session_id: string
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          id?: string
          joined_at?: string
          nickname?: string
          score?: number
          session_id?: string
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_questions: {
        Row: {
          correct_answer: string
          difficulty: string
          id: string
          options: Json
          question_text: string
          topic: string
        }
        Insert: {
          correct_answer: string
          difficulty?: string
          id?: string
          options: Json
          question_text: string
          topic?: string
        }
        Update: {
          correct_answer?: string
          difficulty?: string
          id?: string
          options?: Json
          question_text?: string
          topic?: string
        }
        Relationships: []
      }
      arena_results: {
        Row: {
          created_at: string
          id: string
          nft_token_id: string | null
          nft_tx_hash: string | null
          nickname: string
          score: number
          session_id: string
          user_id: string | null
          wallet_address: string | null
          winner_player_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nft_token_id?: string | null
          nft_tx_hash?: string | null
          nickname: string
          score?: number
          session_id: string
          user_id?: string | null
          wallet_address?: string | null
          winner_player_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nft_token_id?: string | null
          nft_tx_hash?: string | null
          nickname?: string
          score?: number
          session_id?: string
          user_id?: string | null
          wallet_address?: string | null
          winner_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_results_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "arena_players"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_room_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          payload: Json
          player_id: string | null
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          payload?: Json
          player_id?: string | null
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          payload?: Json
          player_id?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_room_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "arena_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_room_players: {
        Row: {
          arena_tokens: number
          chain_color: string
          chain_health: number
          emoji: string
          energy: number
          id: string
          is_bot: boolean
          is_ready: boolean
          joined_at: string
          nickname: string
          room_id: string
          score: number
          seat: number
          territories: number
          user_id: string | null
          validators: number
          warriors: Json
          xp_earned: number
        }
        Insert: {
          arena_tokens?: number
          chain_color?: string
          chain_health?: number
          emoji?: string
          energy?: number
          id?: string
          is_bot?: boolean
          is_ready?: boolean
          joined_at?: string
          nickname: string
          room_id: string
          score?: number
          seat: number
          territories?: number
          user_id?: string | null
          validators?: number
          warriors?: Json
          xp_earned?: number
        }
        Update: {
          arena_tokens?: number
          chain_color?: string
          chain_health?: number
          emoji?: string
          energy?: number
          id?: string
          is_bot?: boolean
          is_ready?: boolean
          joined_at?: string
          nickname?: string
          room_id?: string
          score?: number
          seat?: number
          territories?: number
          user_id?: string | null
          validators?: number
          warriors?: Json
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "arena_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_rooms: {
        Row: {
          actions_per_turn: number
          actions_remaining: number
          board: Json
          code: string
          created_at: string
          current_player_id: string | null
          current_round: number
          event_mode: boolean
          host_user_id: string
          id: string
          max_players: number
          max_rounds: number
          mode: string
          status: string
          turn_seconds: number
          turn_started_at: string | null
          updated_at: string
        }
        Insert: {
          actions_per_turn?: number
          actions_remaining?: number
          board?: Json
          code: string
          created_at?: string
          current_player_id?: string | null
          current_round?: number
          event_mode?: boolean
          host_user_id: string
          id?: string
          max_players?: number
          max_rounds?: number
          mode?: string
          status?: string
          turn_seconds?: number
          turn_started_at?: string | null
          updated_at?: string
        }
        Update: {
          actions_per_turn?: number
          actions_remaining?: number
          board?: Json
          code?: string
          created_at?: string
          current_player_id?: string | null
          current_round?: number
          event_mode?: boolean
          host_user_id?: string
          id?: string
          max_players?: number
          max_rounds?: number
          mode?: string
          status?: string
          turn_seconds?: number
          turn_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          created_at: string
          event_id: string
          id: string
          kind: string
          message: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          kind?: string
          message: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          kind?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_submissions: {
        Row: {
          attempt_id: string | null
          challenge_id: string
          created_at: string
          event_id: string | null
          evidence: Json | null
          id: string
          kind: Database["public"]["Enums"]["submission_kind"]
          payload: Json
          rejection_reason: string | null
          round_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempt_id?: string | null
          challenge_id: string
          created_at?: string
          event_id?: string | null
          evidence?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["submission_kind"]
          payload: Json
          rejection_reason?: string | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempt_id?: string | null
          challenge_id?: string
          created_at?: string
          event_id?: string | null
          evidence?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["submission_kind"]
          payload?: Json
          rejection_reason?: string | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_submissions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "mission_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          accent: string
          ai_prompt: string | null
          ai_ready: boolean
          badge_title: string
          brief: string
          build_prompt: string
          concept: string
          created_at: string
          emoji: string
          est_minutes: number
          id: string
          slug: string
          steps: Json
          submission: Json
          tagline: string
          tier: string
          title: string
          verification: Json
          xp_reward: number
        }
        Insert: {
          accent?: string
          ai_prompt?: string | null
          ai_ready?: boolean
          badge_title?: string
          brief?: string
          build_prompt?: string
          concept?: string
          created_at?: string
          emoji?: string
          est_minutes?: number
          id: string
          slug: string
          steps?: Json
          submission?: Json
          tagline?: string
          tier?: string
          title: string
          verification?: Json
          xp_reward?: number
        }
        Update: {
          accent?: string
          ai_prompt?: string | null
          ai_ready?: boolean
          badge_title?: string
          brief?: string
          build_prompt?: string
          concept?: string
          created_at?: string
          emoji?: string
          est_minutes?: number
          id?: string
          slug?: string
          steps?: Json
          submission?: Json
          tagline?: string
          tier?: string
          title?: string
          verification?: Json
          xp_reward?: number
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          cta_label: string
          cta_url: string | null
          day_index: number
          description: string
          emoji: string
          id: string
          title: string
          xp_reward: number
        }
        Insert: {
          cta_label?: string
          cta_url?: string | null
          day_index: number
          description?: string
          emoji?: string
          id: string
          title: string
          xp_reward?: number
        }
        Update: {
          cta_label?: string
          cta_url?: string | null
          day_index?: number
          description?: string
          emoji?: string
          id?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          event_id: string
          event_score: number
          id: string
          joined_at: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          event_score?: number
          id?: string
          joined_at?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          event_score?: number
          id?: string
          joined_at?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda: Json | null
          capacity: number | null
          category: string | null
          cover_emoji: string | null
          cover_image_url: string | null
          created_at: string
          current_round_id: string | null
          description: string | null
          difficulty: string | null
          ends_at: string | null
          format: string
          host_user_id: string | null
          id: string
          is_platform_event: boolean | null
          leaderboard_visible: boolean
          location: string | null
          missions: string[] | null
          reward_pool: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          tracks: string[] | null
          updated_at: string
          zoom_url: string | null
        }
        Insert: {
          agenda?: Json | null
          capacity?: number | null
          category?: string | null
          cover_emoji?: string | null
          cover_image_url?: string | null
          created_at?: string
          current_round_id?: string | null
          description?: string | null
          difficulty?: string | null
          ends_at?: string | null
          format?: string
          host_user_id?: string | null
          id?: string
          is_platform_event?: boolean | null
          leaderboard_visible?: boolean
          location?: string | null
          missions?: string[] | null
          reward_pool?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          tracks?: string[] | null
          updated_at?: string
          zoom_url?: string | null
        }
        Update: {
          agenda?: Json | null
          capacity?: number | null
          category?: string | null
          cover_emoji?: string | null
          cover_image_url?: string | null
          created_at?: string
          current_round_id?: string | null
          description?: string | null
          difficulty?: string | null
          ends_at?: string | null
          format?: string
          host_user_id?: string | null
          id?: string
          is_platform_event?: boolean | null
          leaderboard_visible?: boolean
          location?: string | null
          missions?: string[] | null
          reward_pool?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          tracks?: string[] | null
          updated_at?: string
          zoom_url?: string | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          created_at: string
          current_question_index: number
          host_user_id: string
          id: string
          join_code: string
          question_started_at: string | null
          status: string
          winner_claimed_at: string | null
          winner_player_id: string | null
        }
        Insert: {
          created_at?: string
          current_question_index?: number
          host_user_id: string
          id?: string
          join_code: string
          question_started_at?: string | null
          status?: string
          winner_claimed_at?: string | null
          winner_player_id?: string | null
        }
        Update: {
          created_at?: string
          current_question_index?: number
          host_user_id?: string
          id?: string
          join_code?: string
          question_started_at?: string | null
          status?: string
          winner_claimed_at?: string | null
          winner_player_id?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          category: string
          created_at: string
          description: string
          difficulty: string
          duration: string
          emoji: string
          event_types: string[]
          id: string
          learning_outcome: string
          persona: string
          reward_type: string
          status: string
          themes: string[]
          title: string
          xp_reward: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          difficulty?: string
          duration?: string
          emoji?: string
          event_types?: string[]
          id: string
          learning_outcome?: string
          persona: string
          reward_type?: string
          status?: string
          themes?: string[]
          title: string
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          difficulty?: string
          duration?: string
          emoji?: string
          event_types?: string[]
          id?: string
          learning_outcome?: string
          persona?: string
          reward_type?: string
          status?: string
          themes?: string[]
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      mission_attempts: {
        Row: {
          accuracy_pct: number
          attempts_used: number
          completed_at: string | null
          difficulty_multiplier: number
          duration_ms: number | null
          event_id: string | null
          fast_finisher: boolean
          game_id: string
          id: string
          perfect_run: boolean
          round_id: string | null
          score: number
          speed_bonus: number
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          user_id: string
        }
        Insert: {
          accuracy_pct?: number
          attempts_used?: number
          completed_at?: string | null
          difficulty_multiplier?: number
          duration_ms?: number | null
          event_id?: string | null
          fast_finisher?: boolean
          game_id: string
          id?: string
          perfect_run?: boolean
          round_id?: string | null
          score?: number
          speed_bonus?: number
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          user_id: string
        }
        Update: {
          accuracy_pct?: number
          attempts_used?: number
          completed_at?: string | null
          difficulty_multiplier?: number
          duration_ms?: number | null
          event_id?: string | null
          fast_finisher?: boolean
          game_id?: string
          id?: string
          perfect_run?: boolean
          round_id?: string | null
          score?: number
          speed_bonus?: number
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_attempts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_badges: {
        Row: {
          emoji: string | null
          event_id: string | null
          game_id: string | null
          id: string
          minted_at: string
          rarity: string
          title: string
          user_id: string
        }
        Insert: {
          emoji?: string | null
          event_id?: string | null
          game_id?: string | null
          id?: string
          minted_at?: string
          rarity?: string
          title: string
          user_id: string
        }
        Update: {
          emoji?: string | null
          event_id?: string | null
          game_id?: string | null
          id?: string
          minted_at?: string
          rarity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_badges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_mints: {
        Row: {
          challenge_id: string
          contract_address: string
          event_id: string | null
          id: string
          metadata: Json | null
          minted_at: string
          network: string
          recipient_address: string
          token_id: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          contract_address: string
          event_id?: string | null
          id?: string
          metadata?: Json | null
          minted_at?: string
          network?: string
          recipient_address: string
          token_id: string
          tx_hash: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          contract_address?: string
          event_id?: string | null
          id?: string
          metadata?: Json | null
          minted_at?: string
          network?: string
          recipient_address?: string
          token_id?: string
          tx_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_mints_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          builders_hub_handle: string | null
          builders_hub_signed: boolean
          created_at: string
          email: string | null
          emoji: string
          id: string
          is_admin: boolean
          level: number
          persona: Database["public"]["Enums"]["persona"]
          stage: string
          status_tag: string | null
          streak: number
          telegram_handle: string | null
          updated_at: string
          user_id: string
          username: string
          wallet_address: string | null
          x_handle: string | null
          xp: number
        }
        Insert: {
          builders_hub_handle?: string | null
          builders_hub_signed?: boolean
          created_at?: string
          email?: string | null
          emoji?: string
          id?: string
          is_admin?: boolean
          level?: number
          persona?: Database["public"]["Enums"]["persona"]
          stage?: string
          status_tag?: string | null
          streak?: number
          telegram_handle?: string | null
          updated_at?: string
          user_id: string
          username: string
          wallet_address?: string | null
          x_handle?: string | null
          xp?: number
        }
        Update: {
          builders_hub_handle?: string | null
          builders_hub_signed?: boolean
          created_at?: string
          email?: string | null
          emoji?: string
          id?: string
          is_admin?: boolean
          level?: number
          persona?: Database["public"]["Enums"]["persona"]
          stage?: string
          status_tag?: string | null
          streak?: number
          telegram_handle?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          wallet_address?: string | null
          x_handle?: string | null
          xp?: number
        }
        Relationships: []
      }
      quest_submissions: {
        Row: {
          created_at: string
          evidence: string
          id: string
          quest_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          created_at?: string
          evidence?: string
          id?: string
          quest_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          created_at?: string
          evidence?: string
          id?: string
          quest_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "quest_submissions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          category: string
          created_at: string
          description: string
          emoji: string
          evidence_kind: string
          id: string
          is_active: boolean
          placeholder: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          emoji?: string
          evidence_kind?: string
          id: string
          is_active?: boolean
          placeholder?: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          emoji?: string
          evidence_kind?: string
          id?: string
          is_active?: boolean
          placeholder?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      reward_payouts: {
        Row: {
          amount_usd: number
          created_at: string
          event_id: string | null
          id: string
          rank: number
          sent: boolean
          sent_at: string | null
          tx_hash: string | null
          user_id: string
          username: string
          wallet_address: string | null
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          event_id?: string | null
          id?: string
          rank: number
          sent?: boolean
          sent_at?: string | null
          tx_hash?: string | null
          user_id: string
          username: string
          wallet_address?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          event_id?: string | null
          id?: string
          rank?: number
          sent?: boolean
          sent_at?: string | null
          tx_hash?: string | null
          user_id?: string
          username?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      rewards: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          kind: string
          rarity: string
          title: string
          user_id: string
          value: string | null
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          rarity?: string
          title: string
          user_id: string
          value?: string | null
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          rarity?: string
          title?: string
          user_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          ended_at: string | null
          ends_at: string | null
          event_id: string
          game_id: string
          id: string
          round_number: number
          started_at: string | null
          status: Database["public"]["Enums"]["round_status"]
          time_limit_seconds: number
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ends_at?: string | null
          event_id: string
          game_id: string
          id?: string
          round_number: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          time_limit_seconds?: number
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ends_at?: string | null
          event_id?: string
          game_id?: string
          id?: string
          round_number?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          time_limit_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string
          created_at: string
          event_id: string
          id: string
          name: string
          persona: Database["public"]["Enums"]["persona"]
          score: number
        }
        Insert: {
          color: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          persona: Database["public"]["Enums"]["persona"]
          score?: number
        }
        Update: {
          color?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          persona?: Database["public"]["Enums"]["persona"]
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_progress: {
        Row: {
          completed_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      unified_leaderboard: {
        Row: {
          arena_xp: number | null
          builders_hub_signed: boolean | null
          emoji: string | null
          profile_xp: number | null
          quest_xp: number | null
          rank: number | null
          total_xp: number | null
          user_id: string | null
          username: string | null
          wallet_address: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_quest_submission: {
        Args: { _submission_id: string }
        Returns: undefined
      }
      arena_attach_wallet: {
        Args: { _player_id: string; _wallet: string }
        Returns: undefined
      }
      arena_submit_answer: {
        Args: {
          _player_id: string
          _question_id: string
          _response_time_ms: number
          _selected_answer: string
          _session_id: string
        }
        Returns: Json
      }
      complete_daily_task: { Args: { _task_id: string }; Returns: Json }
      finalize_event_leaderboard: {
        Args: { _event_id: string; _pool?: number }
        Returns: number
      }
      get_admin_stats: { Args: never; Returns: Json }
      get_app_setting: { Args: { _key: string }; Returns: string }
      get_event_leaderboard: {
        Args: { _event_id: string }
        Returns: {
          attempts_completed: number
          emoji: string
          event_score: number
          persona: Database["public"]["Enums"]["persona"]
          team_color: string
          team_id: string
          team_name: string
          user_id: string
          username: string
        }[]
      }
      get_leaderboard: {
        Args: {
          _limit?: number
          _persona?: Database["public"]["Enums"]["persona"]
        }
        Returns: {
          emoji: string
          level: number
          persona: Database["public"]["Enums"]["persona"]
          stage: string
          status_tag: string
          streak: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          builders_hub_handle: string | null
          builders_hub_signed: boolean
          created_at: string
          email: string | null
          emoji: string
          id: string
          is_admin: boolean
          level: number
          persona: Database["public"]["Enums"]["persona"]
          stage: string
          status_tag: string | null
          streak: number
          telegram_handle: string | null
          updated_at: string
          user_id: string
          username: string
          wallet_address: string | null
          x_handle: string | null
          xp: number
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          emoji: string
          level: number
          persona: Database["public"]["Enums"]["persona"]
          stage: string
          status_tag: string
          streak: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_event_host: { Args: { _event_id: string }; Returns: boolean }
      issue_reward: {
        Args: {
          _attempt_id: string
          _description: string
          _event_id: string
          _kind: string
          _rarity: string
          _title: string
          _value: string
        }
        Returns: string
      }
      mark_submission_rejected: {
        Args: { _evidence: Json; _reason: string; _submission_id: string }
        Returns: undefined
      }
      mark_submission_verified: {
        Args: { _evidence: Json; _submission_id: string }
        Returns: undefined
      }
      mint_badge: {
        Args: {
          _attempt_id: string
          _emoji: string
          _event_id: string
          _game_id: string
          _rarity: string
          _title: string
        }
        Returns: string
      }
      record_nft_mint: {
        Args: {
          _challenge_id: string
          _contract_address: string
          _event_id: string
          _metadata: Json
          _recipient_address: string
          _token_id: string
          _tx_hash: string
          _user_id: string
        }
        Returns: string
      }
      record_submission: {
        Args: {
          _attempt_id: string
          _challenge_id: string
          _event_id: string
          _kind: Database["public"]["Enums"]["submission_kind"]
          _payload: Json
          _round_id: string
        }
        Returns: string
      }
      reject_quest_submission: {
        Args: { _reason: string; _submission_id: string }
        Returns: undefined
      }
      set_app_setting: {
        Args: { _key: string; _value: string }
        Returns: undefined
      }
      submit_attempt: {
        Args: {
          _accuracy_pct: number
          _attempts_used: number
          _difficulty_multiplier: number
          _duration_ms: number
          _event_id: string
          _game_id: string
          _round_id: string
          _time_limit_seconds: number
          _xp_reward: number
        }
        Returns: Json
      }
      submit_quest: {
        Args: { _evidence: string; _quest_id: string }
        Returns: string
      }
    }
    Enums: {
      attempt_status: "in_progress" | "completed" | "failed" | "timeout"
      event_status: "draft" | "live" | "paused" | "ended"
      persona: "student" | "developer" | "builder" | "founder" | "business"
      round_status: "pending" | "active" | "completed"
      submission_kind:
        | "wallet"
        | "tx_hash"
        | "contract"
        | "github"
        | "json"
        | "custom"
      submission_status: "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attempt_status: ["in_progress", "completed", "failed", "timeout"],
      event_status: ["draft", "live", "paused", "ended"],
      persona: ["student", "developer", "builder", "founder", "business"],
      round_status: ["pending", "active", "completed"],
      submission_kind: [
        "wallet",
        "tx_hash",
        "contract",
        "github",
        "json",
        "custom",
      ],
      submission_status: ["pending", "verified", "rejected"],
    },
  },
} as const
