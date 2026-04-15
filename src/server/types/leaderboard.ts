import { z } from "zod";

export const userRoleValues = ["runner", "runner", "admin"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const questTypeValues = [
  "event",
  "optional",
  "arena",
  "story",
  "special",
] as const;
export type QuestType = (typeof questTypeValues)[number];

export const runCategoryValues = ["fs", "rr", "ta-wiki"] as const;
export type RunCategoryId = (typeof runCategoryValues)[number];

export const leaderboardCategoryIconValues = [
  "flame",
  "shield",
  "book-open",
] as const;
export type LeaderboardCategoryIcon =
  (typeof leaderboardCategoryIconValues)[number];

export const leaderboardCategoryColorValues = [
  "amber",
  "cyan",
  "emerald",
  "violet",
] as const;
export type LeaderboardCategoryColor =
  (typeof leaderboardCategoryColorValues)[number];

export const runTagKeys = ["heroics"] as const;
export type RunTagKey = (typeof runTagKeys)[number];

export const leaderboardCategoryFilterValues = [
  "all",
  ...runCategoryValues,
] as const;
export type LeaderboardCategoryFilterKey =
  (typeof leaderboardCategoryFilterValues)[number];

export const leaderboardWeaponKeys = [
  "gs",
  "ls",
  "db",
  "sns",
  "sa",
  "hh",
  "lbg",
  "hbg",
  "lan",
  "ham",
  "cb",
  "gl",
  "ig",
  "bow",
] as const;
export type LeaderboardWeaponKey = (typeof leaderboardWeaponKeys)[number];

export const leaderboardAreaKeys = [
  "plains",
  "forest",
  "basin",
  "cliffs",
  "wyveria",
  "arena",
  "other",
] as const;
export type LeaderboardAreaKey = (typeof leaderboardAreaKeys)[number];

export interface LeaderboardUserResource {
  id: string;
  name: string;
  image: string | null;
  role: UserRole;
}

export interface LeaderboardQuestResource {
  id: string;
  slug: string;
  title: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  difficultyStars: number;
}

export interface LeaderboardTagResource {
  id: string;
  key: RunTagKey;
  label: string;
}

export interface LeaderboardCategoryResource {
  id: RunCategoryId;
  label: string;
  icon: LeaderboardCategoryIcon;
  color: LeaderboardCategoryColor;
  description: string;
  link: string | null;
}

export interface LeaderboardWeaponResource {
  key: LeaderboardWeaponKey;
  label: string;
}

export interface LeaderboardAreaResource {
  key: LeaderboardAreaKey;
  label: string;
}

export interface LeaderboardRunResource {
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
}

export const leaderboardFiltersSchema = z.object({
  questSlug: z.string().optional(),
  categoryId: z.enum(leaderboardCategoryFilterValues).default("all"),
});

export type LeaderboardFilters = z.infer<typeof leaderboardFiltersSchema>;

export interface LeaderboardQuestOption {
  slug: string;
  title: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  areaLabel: string;
  difficultyStars: number;
}

export interface LeaderboardTagOption {
  key: RunTagKey;
  label: string;
}

export interface LeaderboardCategoryOption {
  id: RunCategoryId;
  label: string;
  icon: LeaderboardCategoryIcon;
  color: LeaderboardCategoryColor;
}

export interface LeaderboardRow {
  rank: number;
  runId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  hunterName: string;
  questSlug: string;
  questTitle: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  areaLabel: string;
  difficultyStars: number;
  submittedAtMs: number;
  submittedAtLabel: string;
  runTimeMs: number;
  runTimeLabel: string;
  categoryId: RunCategoryId;
  categoryLabel: string;
  categoryIcon: LeaderboardCategoryIcon;
  categoryColor: LeaderboardCategoryColor;
  tagLabels: string[];
  primaryWeaponKey: LeaderboardWeaponKey;
  primaryWeaponLabel: string;
  secondaryWeaponKey: LeaderboardWeaponKey | null;
  secondaryWeaponLabel: string | null;
}

export function formatRunTime(runTimeMs: number) {
  const totalCentiseconds = Math.round(runTimeMs / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${String(minutes).padStart(2, "0")}'${String(seconds).padStart(
    2,
    "0",
  )}"${String(centiseconds).padStart(2, "0")}`;
}
