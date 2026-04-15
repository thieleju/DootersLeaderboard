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
  type LeaderboardCategoryColor,
  type LeaderboardCategoryIcon,
  type LeaderboardCategoryResource,
  type LeaderboardCategoryOption,
  type LeaderboardQuestOption,
  type LeaderboardRow,
  type LeaderboardTagResource,
  type LeaderboardWeaponKey,
  type LeaderboardWeaponResource,
  formatRunTime,
} from "~/server/types/leaderboard";

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
const tags = readJsonResource<LeaderboardTagResource[]>("tags.jsonc");
const categories =
  readJsonResource<LeaderboardCategoryResource[]>("categories.jsonc");

const areaByKey = new Map(areas.map((area) => [area.key, area]));
const weaponByKey = new Map(weapons.map((weapon) => [weapon.key, weapon]));
const categoryById = new Map(
  categories.map((category) => [category.id, category]),
);
const tagByLabel = new Map(
  tags.map((tag) => [tag.label.trim().toLowerCase(), tag]),
);

export async function getLeaderboardFilters(): Promise<{
  quests: LeaderboardQuestOption[];
  categories: LeaderboardCategoryOption[];
  defaultQuestSlug: string;
}> {
  const quests = await db
    .select({
      slug: questsTable.slug,
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
    }));

  return {
    quests: quests.map<LeaderboardQuestOption>((quest) => {
      const areaKey = quest.areaKey as LeaderboardAreaKey;

      return {
        slug: quest.slug,
        title: quest.title,
        monster: quest.monster,
        type: quest.type,
        areaKey,
        areaLabel: areaByKey.get(areaKey)?.label ?? areaKey,
        difficultyStars: quest.difficultyStars,
      };
    }),
    categories: availableCategories,
    defaultQuestSlug: quests[0]?.slug ?? "",
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
      slug: questsTable.slug,
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
      userName: usersTable.name,
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
    const runTags = parseRunTags(run.tags)
      .map((tagLabel) => tagByLabel.get(tagLabel.trim().toLowerCase()))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
    const category = categoryById.get(run.category);
    const categoryLabel = category?.label ?? (run.category as string);
    const categoryIcon = (category?.icon ?? "flame") as LeaderboardCategoryIcon;
    const categoryColor = (category?.color ??
      "amber") as LeaderboardCategoryColor;

    const existingRows = rowsByQuestId.get(run.questId) ?? [];
    existingRows.push({
      rank: 0,
      runId: run.runId,
      userId: run.userId,
      userName: run.userName ?? run.hunterName,
      userImage: run.userImage ?? null,
      hunterName: run.hunterName,
      questSlug: quest.slug,
      questTitle: quest.title,
      monster: quest.monster,
      type: quest.type,
      areaKey: quest.areaKey as LeaderboardAreaKey,
      areaLabel:
        areaByKey.get(quest.areaKey as LeaderboardAreaKey)?.label ??
        (quest.areaKey as LeaderboardAreaKey),
      difficultyStars: quest.difficultyStars,
      submittedAtMs:
        run.submittedAt instanceof Date
          ? run.submittedAt.getTime()
          : new Date(run.submittedAt).getTime(),
      submittedAtLabel: new Date(run.submittedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      runTimeMs: run.runTimeMs,
      runTimeLabel: formatRunTime(run.runTimeMs),
      categoryId: run.category,
      categoryLabel,
      categoryIcon,
      categoryColor,
      tagLabels: runTags.map((tag) => tag.label),
      primaryWeaponKey: run.primaryWeaponKey as LeaderboardWeaponKey,
      primaryWeaponLabel:
        weaponByKey.get(run.primaryWeaponKey as LeaderboardWeaponKey)?.label ??
        (run.primaryWeaponKey as LeaderboardWeaponKey),
      secondaryWeaponKey: run.secondaryWeaponKey
        ? (run.secondaryWeaponKey as LeaderboardWeaponKey)
        : null,
      secondaryWeaponLabel: run.secondaryWeaponKey
        ? (weaponByKey.get(run.secondaryWeaponKey as LeaderboardWeaponKey)
            ?.label ?? (run.secondaryWeaponKey as LeaderboardWeaponKey))
        : null,
    });
    rowsByQuestId.set(run.questId, existingRows);
  }

  const rows: LeaderboardRow[] = [];
  for (const [questId, questRows] of rowsByQuestId.entries()) {
    const sorted = questRows
      .slice()
      .sort(
        (a, b) =>
          a.runTimeMs - b.runTimeMs || a.submittedAtMs - b.submittedAtMs,
      )
      .map((row, index) => ({ ...row, rank: index + 1 }));
    rows.push(...sorted);
    void questId;
  }

  const selectedQuest = quests[0] ?? null;

  return {
    quest: selectedQuest
      ? {
          slug: selectedQuest.slug,
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
