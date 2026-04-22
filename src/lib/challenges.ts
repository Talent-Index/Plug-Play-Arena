// ═══════════════════════════════════════════════════════════════════
// Avalanche Speedrun Challenges — Types & Helpers
// Challenge catalog data now lives in Supabase (challenges table).
// ═══════════════════════════════════════════════════════════════════

export type SubmissionKind = 'wallet' | 'tx_hash' | 'contract' | 'github' | 'json' | 'custom';
export type ChallengeTier = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ChallengeStep {
  title: string;
  detail: string;
  hint?: string;
}

export interface ChallengeSubmissionField {
  key: string;
  label: string;
  kind: SubmissionKind;
  placeholder: string;
  helpText?: string;
}

export interface AvalancheChallenge {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  emoji: string;
  accent: 'cyan' | 'magenta' | 'gold' | 'lime' | 'pink' | 'sky';
  tier: ChallengeTier;
  aiReady: boolean;
  estMinutes: number;
  xpReward: number;
  badgeTitle: string;
  concept: string;
  brief: string;
  steps: ChallengeStep[];
  buildPrompt: string;
  aiPrompt?: string;
  submission: {
    primary: ChallengeSubmissionField;
    extras?: ChallengeSubmissionField[];
  };
  verification: {
    kind: SubmissionKind;
    rules: string[];
  };
}

// ── DB row → AvalancheChallenge mapper ───────────────────────────
export function dbRowToChallenge(row: {
  id: string; slug: string; title: string; tagline: string;
  emoji: string; accent: string; tier: string; ai_ready: boolean;
  est_minutes: number; xp_reward: number; badge_title: string;
  concept: string; brief: string; steps: unknown;
  build_prompt: string; ai_prompt: string | null;
  submission: unknown; verification: unknown;
}): AvalancheChallenge {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    emoji: row.emoji,
    accent: row.accent as AvalancheChallenge['accent'],
    tier: row.tier as ChallengeTier,
    aiReady: row.ai_ready,
    estMinutes: row.est_minutes,
    xpReward: row.xp_reward,
    badgeTitle: row.badge_title,
    concept: row.concept,
    brief: row.brief,
    steps: (row.steps as ChallengeStep[]) || [],
    buildPrompt: row.build_prompt,
    aiPrompt: row.ai_prompt || undefined,
    submission: row.submission as AvalancheChallenge['submission'],
    verification: row.verification as AvalancheChallenge['verification'],
  };
}

export const ACCENT_CLASS: Record<AvalancheChallenge['accent'], string> = {
  cyan:    'text-[hsl(180_85%_70%)]',
  magenta: 'text-[hsl(310_85%_72%)]',
  gold:    'text-[hsl(42_95%_65%)]',
  lime:    'text-[hsl(85_75%_65%)]',
  pink:    'text-[hsl(340_90%_72%)]',
  sky:     'text-[hsl(200_90%_72%)]',
};

export const TIER_BADGE: Record<ChallengeTier, string> = {
  Beginner:     'bg-[hsl(145_70%_45%/0.15)] text-[hsl(145_70%_60%)] border-[hsl(145_70%_45%/0.4)]',
  Intermediate: 'bg-[hsl(45_100%_55%/0.12)] text-[hsl(45_100%_65%)] border-[hsl(45_100%_55%/0.4)]',
  Advanced:     'bg-[hsl(354_100%_61%/0.12)] text-[hsl(354_100%_70%)] border-[hsl(354_100%_61%/0.4)]',
};
