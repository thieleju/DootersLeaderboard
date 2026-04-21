import type { LeaderboardAreaKey, QuestType } from "~/server/types/leaderboard";

export type QuestManagementRow = {
  id: string;
  title: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  areaLabel: string;
  difficultyStars: number;
  approvedRunCount: number;
  approvers: Array<{ userId: string; name: string }>;
};

export type QuestUpsertInput = {
  title: string;
  monster: string;
  type: QuestType;
  areaKey: LeaderboardAreaKey;
  difficultyStars: number;
};

export type QuestUpdateInput = QuestUpsertInput & {
  questId: string;
};

export type QuestFormOptions = {
  areas: Array<{ key: LeaderboardAreaKey; label: string }>;
  questTypes: Array<{ key: QuestType; label: string }>;
};
