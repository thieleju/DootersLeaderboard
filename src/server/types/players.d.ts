import type { RunCategoryId, UserRole } from "~/server/types/leaderboard";

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
  hunterName: string;
  questTitle: string;
  monster: string;
  difficultyStars: number;
  areaLabel: string;
  submittedAtMs: number;
  runTimeMs: number;
  categoryId: RunCategoryId;
  tagLabels: string[];
  status: "pending" | "approved" | "rejected";
  primaryWeaponKey: string;
  secondaryWeaponKey: string | null;
  isApproved: boolean;
  approvedByDisplayName: string | null;
  approvedAtMs: number | null;
  rejectedAtMs: number | null;
};

export type PlayerProfileData = {
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatar: string | null;
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
  tags: string[];
};
