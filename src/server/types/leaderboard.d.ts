export type UserRole = "runner" | "moderator" | "admin";

export type QuestType = "event" | "optional" | "arena" | "investigation";

export type RunCategoryId = string;

export type LeaderboardCategoryIcon =
  | "flame"
  | "shield"
  | "book-open"
  | "sword";

export type LeaderboardCategoryColor = "amber" | "cyan" | "emerald" | "violet";

export type RunTagKey = "heroics";

export type LeaderboardCategoryFilterKey = string;

export type LeaderboardWeaponKey =
  | "gs"
  | "ls"
  | "db"
  | "sns"
  | "sa"
  | "hh"
  | "lbg"
  | "hbg"
  | "lan"
  | "ham"
  | "cb"
  | "gl"
  | "ig"
  | "bow";

export type LeaderboardAreaKey =
  | "plains"
  | "forest"
  | "basin"
  | "cliffs"
  | "wyveria"
  | "arena"
  | "other";

export type LeaderboardUserResource = {
  id: string;
  displayName: string;
  username: string;
  image: string | null;
  role: UserRole;
};

export type LeaderboardQuestResource = {
  title: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  difficultyStars: number;
};

export type LeaderboardTagResource = {
  id: string;
  key: RunTagKey;
  label: string;
};

export type LeaderboardCategoryResource = {
  id: RunCategoryId;
  label: string;
  icon: LeaderboardCategoryIcon;
  color: LeaderboardCategoryColor;
  description: string;
  link: string | null;
};

export type LeaderboardWeaponResource = {
  key: LeaderboardWeaponKey;
  label: string;
};

export type LeaderboardAreaResource = {
  key: LeaderboardAreaKey;
  label: string;
};

export type LeaderboardRunResource = {
  id: string;
  userId: string;
  hunterName: string;
  questId: string;
  category: RunCategoryId;
  tags: string[] | null;
  submittedAtMs: number;
  runTimeMs: number;
  primaryWeaponKey: LeaderboardWeaponKey;
  secondaryWeaponKey: LeaderboardWeaponKey | null;
  approvedByUserId: string | null;
  approvedAtMs: number | null;
};

export type LeaderboardFilters = {
  questId?: string;
  categoryId: LeaderboardCategoryFilterKey;
};

export type LeaderboardQuestOption = {
  id: string;
  title: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  areaLabel: string;
  difficultyStars: number;
  approvedRunCount?: number;
};

export type LeaderboardTagOption = {
  key: RunTagKey;
  label: string;
};

export type LeaderboardCategoryOption = {
  id: RunCategoryId;
  label: string;
  icon: LeaderboardCategoryIcon;
  color: LeaderboardCategoryColor;
  description: string;
  link: string | null;
};

export type LeaderboardRow = {
  rank: number;
  runId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  hunterName: string;
  questId: string;
  submittedAtMs: number;
  runTimeMs: number;
  youtubeLink: string | null;
  hasScreenshot: boolean;
  score: number;
  categoryId: RunCategoryId;
  tagLabels: string[];
  primaryWeaponKey: LeaderboardWeaponKey;
  secondaryWeaponKey: LeaderboardWeaponKey | null;
};
