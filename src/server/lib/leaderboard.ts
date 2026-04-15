import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import {
  quests as questsTable,
  runs as runsTable,
  users as usersTable,
} from "~/server/db/schema";

import {
  type LeaderboardAreaResource,
  type LeaderboardAreaKey,
  type LeaderboardCategoryResource,
  type LeaderboardCategoryOption,
  type LeaderboardQuestOption,
  type LeaderboardRow,
  type LeaderboardWeaponKey,
  type LeaderboardWeaponResource,
} from "~/server/types/leaderboard";
import { calculatePlacementScore } from "~/server/lib/score";

import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "jsonc-parser";

const resourceDir = path.join(process.cwd(), "src/server/resources");

function readJsonResource<T>(fileName: string) {
  const filePath = path.join(resourceDir, fileName);
  const fileContents = readFileSync(filePath, "utf8");
  const parsed = parse(fileContents);
  if (parsed === undefined) {
    throw new Error(`Failed to parse JSONC resource: ${fileName}`);
  }

  return parsed as T;
}

const areas = readJsonResource<LeaderboardAreaResource[]>("areas.jsonc");
const weapons = readJsonResource<LeaderboardWeaponResource[]>("weapons.jsonc");
const categories =
  readJsonResource<LeaderboardCategoryResource[]>("categories.jsonc");

const areaByKey = new Map(areas.map((area) => [area.key, area]));
const categoryById = new Map(
  categories.map((category) => [category.id, category]),
);

export async function getLeaderboardFilters(): Promise<{
  quests: LeaderboardQuestOption[];
  categories: LeaderboardCategoryOption[];
  defaultQuestId: string;
}> {
  const quests = await db
    .select({
      id: questsTable.id,
      title: questsTable.title,
      monster: questsTable.monster,
      type: questsTable.type,
      areaKey: questsTable.area,
      difficultyStars: questsTable.difficultyStars,
    })
    .from(questsTable)
    .orderBy(desc(questsTable.difficultyStars), asc(questsTable.title));

  const availableCategories = categories
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map<LeaderboardCategoryOption>((category) => ({
      id: category.id,
      label: category.label,
      icon: category.icon,
      color: category.color,
      description: category.description,
      link: category.link,
    }));

  return {
    quests: quests.map<LeaderboardQuestOption>((quest) => {
      const areaKey = quest.areaKey as LeaderboardAreaKey;

      return {
        id: quest.id,
        title: quest.title,
        monster: quest.monster,
        type: quest.type,
        areaKey,
        areaLabel: areaByKey.get(areaKey)?.label ?? areaKey,
        difficultyStars: quest.difficultyStars,
      };
    }),
    categories: availableCategories,
    defaultQuestId: quests[0]?.id ?? "",
  };
}

function parseRunTags(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function getLeaderboardRows(): Promise<{
  quest: LeaderboardQuestOption | null;
  rows: LeaderboardRow[];
}> {
  const quests = await db
    .select({
      id: questsTable.id,
      title: questsTable.title,
      monster: questsTable.monster,
      type: questsTable.type,
      areaKey: questsTable.area,
      difficultyStars: questsTable.difficultyStars,
    })
    .from(questsTable);

  if (quests.length === 0) {
    return { quest: null, rows: [] };
  }

  const questById = new Map(quests.map((quest) => [quest.id, quest]));

  const runRows = await db
    .select({
      runId: runsTable.id,
      userId: runsTable.userId,
      questId: runsTable.questId,
      hunterName: runsTable.hunterName,
      category: runsTable.category,
      tags: runsTable.tags,
      submittedAt: runsTable.submittedAt,
      runTimeMs: runsTable.runTimeMs,
      primaryWeaponKey: runsTable.primaryWeapon,
      secondaryWeaponKey: runsTable.secondaryWeapon,
      approvedAt: runsTable.approvedAt,
      userName: usersTable.displayName,
      userImage: usersTable.image,
    })
    .from(runsTable)
    .innerJoin(usersTable, eq(runsTable.userId, usersTable.id))
    .orderBy(
      asc(runsTable.questId),
      asc(runsTable.runTimeMs),
      asc(runsTable.submittedAt),
    );

  const approvedRunRows = runRows.filter((row) => row.approvedAt !== null);

  const bestRunByQuestAndUser = new Map<
    string,
    (typeof approvedRunRows)[number]
  >();
  for (const run of approvedRunRows) {
    const key = `${run.questId}:${run.userId}`;
    if (!bestRunByQuestAndUser.has(key)) {
      bestRunByQuestAndUser.set(key, run);
    }
  }

  const rowsByQuestId = new Map<string, LeaderboardRow[]>();

  for (const run of bestRunByQuestAndUser.values()) {
    const quest = questById.get(run.questId);
    if (!quest) continue;
    const runTags = parseRunTags(run.tags);
    const category = categoryById.get(run.category);

    const existingRows = rowsByQuestId.get(run.questId) ?? [];
    existingRows.push({
      rank: 0,
      runId: run.runId,
      userId: run.userId,
      userName: run.userName ?? run.hunterName,
      userImage: run.userImage ?? null,
      hunterName: run.hunterName,
      questId: quest.id,
      submittedAtMs:
        run.submittedAt instanceof Date
          ? run.submittedAt.getTime()
          : new Date(run.submittedAt).getTime(),
      runTimeMs: run.runTimeMs,
      score: 0,
      categoryId: (category?.id ?? run.category) as typeof run.category,
      tagLabels: runTags,
      primaryWeaponKey: run.primaryWeaponKey as LeaderboardWeaponKey,
      secondaryWeaponKey: run.secondaryWeaponKey
        ? (run.secondaryWeaponKey as LeaderboardWeaponKey)
        : null,
    });
    rowsByQuestId.set(run.questId, existingRows);
  }

  const rows: LeaderboardRow[] = [];
  for (const [questId, questRows] of rowsByQuestId.entries()) {
    const participants = questRows.length;
    const sorted = questRows
      .slice()
      .sort(
        (a, b) =>
          a.runTimeMs - b.runTimeMs || a.submittedAtMs - b.submittedAtMs,
      )
      .map((row, index) => {
        const rank = index + 1;
        return {
          ...row,
          rank,
          score: calculatePlacementScore(rank, participants),
        };
      });
    rows.push(...sorted);
    void questId;
  }

  const selectedQuest = quests[0] ?? null;

  return {
    quest: selectedQuest
      ? {
          id: selectedQuest.id,
          title: selectedQuest.title,
          monster: selectedQuest.monster,
          type: selectedQuest.type,
          areaKey: selectedQuest.areaKey as LeaderboardAreaKey,
          areaLabel:
            areaByKey.get(selectedQuest.areaKey as LeaderboardAreaKey)?.label ??
            (selectedQuest.areaKey as LeaderboardAreaKey),
          difficultyStars: selectedQuest.difficultyStars,
        }
      : null,
    rows,
  };
}
