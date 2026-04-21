import type {
  LeaderboardQuestOption,
  RunCategoryId,
  UserRole
} from "~/server/types/leaderboard";

export type PlayerOverviewRow = {
  userId: string;
  displayName: string;
  avatar: string | null;
  hunterName: string;
  score: number;
  submittedRunsCount: number;
  top3Placements: {
    first: number;
    second: number;
    third: number;
    total: number;
  };
  lastSubmittedAtMs: number;
  mostUsedWeapon: {
    key: string;
    label: string;
    count: number;
  } | null;
};

export type PlayerProfileRunRow = {
  runId: string;
  questId: string;
  hunterName: string;
  youtubeLink: string | null;
  hasScreenshot: boolean;
  questTitle: string;
  monster: string;
  difficultyStars: number;
  areaLabel: string;
  submittedAtMs: number;
  runTimeMs: number;
  score: number | null;
  rank: number | null;
  categoryId: RunCategoryId;
  tagLabels: string[];
  status: "pending" | "approved" | "rejected";
  primaryWeaponKey: string;
  secondaryWeaponKey: string | null;
  isApproved: boolean;
  reviewerDisplayName: string | null;
  approvedByDisplayName: string | null;
  approvedAtMs: number | null;
  rejectedByDisplayName: string | null;
  rejectedAtMs: number | null;
};

export type PlayerProfileData = {
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatar: string | null;
    role: UserRole;
  } | null;
  performance: {
    score: number;
    top3Placements: {
      first: number;
      second: number;
      third: number;
    };
  };
  runs: PlayerProfileRunRow[];
  isCurrentUser: boolean;
  viewerRole: UserRole | null;
  leaderboardPlacement: number | null;
};

export type SubmitRunInput = {
  questId: string;
  hunterName: string;
  runTime: string;
  category: RunCategoryId;
  primaryWeaponKey: string;
  secondaryWeaponKey: string;
  youtubeLink?: string;
  screenshotBase64?: string;
  tags: string[];
};

export type SubmitRunAutofill = {
  hunterName: string;
  category: RunCategoryId;
  primaryWeaponKey: string;
  secondaryWeaponKey: string;
} | null;

export type SubmitRunOptionsData = {
  quests: LeaderboardQuestOption[];
  categories: Array<{ id: RunCategoryId; label: string }>;
  weapons: Array<{ key: string; label: string }>;
  existingTags: string[];
  autofillFromLastRun: SubmitRunAutofill;
};

export type ModerationRunRow = {
  runId: string;
  questId: string;
  runnerUserId: string;
  runnerDisplayName: string;
  runnerAvatar: string | null;
  hunterName: string;
  questTitle: string;
  monster: string;
  difficultyStars: number;
  areaLabel: string;
  submittedAtMs: number;
  runTimeMs: number;
  hasScreenshot: boolean;
  youtubeLink: string | null;
  categoryId: RunCategoryId;
  tagLabels: string[];
  primaryWeaponKey: string;
  secondaryWeaponKey: string | null;
};

export type ModerationHistoryRunRow = {
  runId: string;
  questId: string;
  runnerUserId: string;
  runnerDisplayName: string;
  runnerAvatar: string | null;
  hunterName: string;
  questTitle: string;
  monster: string;
  difficultyStars: number;
  areaLabel: string;
  submittedAtMs: number;
  runTimeMs: number;
  hasScreenshot: boolean;
  youtubeLink: string | null;
  categoryId: RunCategoryId;
  tagLabels: string[];
  status: "approved" | "rejected";
  reviewerDisplayName: string | null;
  approvedAtMs: number | null;
  rejectedAtMs: number | null;
  primaryWeaponKey: string;
  secondaryWeaponKey: string | null;
};
