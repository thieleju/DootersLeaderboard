export const SCORE_MIN_SCORE = 500;
export const SCORE_GROWTH_FACTOR = 600;
export const SCORE_EXPONENT = 0.5;

export const QUERY_DEFAULT_STALE_TIME_MS = 30_000;

export const BOT_NOTIFICATION_EVENT_KEYS = [
  "run_submitted",
  "run_approved",
  "run_rejected",
  "quest_modified",
  "user_first_login"
] as const;

export type BotNotificationEventKey =
  (typeof BOT_NOTIFICATION_EVENT_KEYS)[number];

export const BOT_NOTIFICATION_EVENT_META: Record<
  BotNotificationEventKey,
  { label: string; description: string }
> = {
  run_submitted: {
    label: "New Run Submitted",
    description: "Triggered when a player submits a new run."
  },
  run_approved: {
    label: "Run Approved",
    description: "Triggered when a moderator/admin approves a run."
  },
  run_rejected: {
    label: "Run Rejected",
    description: "Triggered when a moderator/admin rejects a run."
  },
  quest_modified: {
    label: "Quest Update",
    description: "Triggered when a quest is created, updated, or deleted."
  },
  user_first_login: {
    label: "User First Login",
    description: "Triggered when a user logs in for the first time."
  }
};
