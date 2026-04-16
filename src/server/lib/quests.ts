import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { parse } from "jsonc-parser";

import { db } from "~/server/db";
import { quests as questsTable } from "~/server/db/schema";
import type {
  LeaderboardAreaResource,
  QuestType
} from "~/server/types/leaderboard";
import type {
  QuestFormOptions,
  QuestManagementRow,
  QuestUpsertInput,
  QuestUpdateInput
} from "~/server/types/quests";

const resourceDir = path.join(process.cwd(), "src/server/resources");

function readJsonResource<T>(fileName: string) {
  const filePath = path.join(resourceDir, fileName);
  const fileContents = readFileSync(filePath, "utf8");
  const parsed: unknown = parse(fileContents);

  if (parsed === undefined) {
    throw new Error(`Failed to parse JSONC resource: ${fileName}`);
  }

  return parsed as T;
}

const areas = readJsonResource<LeaderboardAreaResource[]>("areas.jsonc");
const areaLabelByKey = new Map(areas.map((area) => [area.key, area.label]));

const questTypeLabels: Record<QuestType, string> = {
  event: "Event",
  optional: "Optional",
  arena: "Arena",
  investigation: "Investigation"
};

export function getQuestFormOptions(): QuestFormOptions {
  return {
    areas: areas.map((area) => ({ key: area.key, label: area.label })),
    questTypes: (Object.keys(questTypeLabels) as QuestType[]).map((key) => ({
      key,
      label: questTypeLabels[key]
    }))
  };
}

export async function listQuests(): Promise<QuestManagementRow[]> {
  const rows = await db
    .select({
      id: questsTable.id,
      title: questsTable.title,
      monster: questsTable.monster,
      type: questsTable.type,
      areaKey: questsTable.area,
      difficultyStars: questsTable.difficultyStars
    })
    .from(questsTable)
    .orderBy(desc(questsTable.difficultyStars), asc(questsTable.title));

  return rows.map((row) => {
    const areaKey = row.areaKey as QuestManagementRow["areaKey"];
    return {
      id: row.id,
      title: row.title,
      monster: row.monster,
      type: row.type,
      areaKey,
      areaLabel: areaLabelByKey.get(areaKey) ?? areaKey,
      difficultyStars: row.difficultyStars
    };
  });
}

export async function createQuest(input: QuestUpsertInput) {
  const questId = crypto.randomUUID();
  await db.insert(questsTable).values({
    id: questId,
    title: input.title,
    monster: input.monster,
    type: "event",
    area: input.areaKey,
    difficultyStars: input.difficultyStars
  });

  return { questId };
}

export async function updateQuest(input: QuestUpdateInput) {
  const existingQuest = await db
    .select({ id: questsTable.id })
    .from(questsTable)
    .where(eq(questsTable.id, input.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existingQuest) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
  }

  await db
    .update(questsTable)
    .set({
      title: input.title,
      monster: input.monster,
      area: input.areaKey,
      difficultyStars: input.difficultyStars
    })
    .where(eq(questsTable.id, input.questId));

  return { questId: input.questId };
}

export async function deleteQuest(input: { questId: string }) {
  const existingQuest = await db
    .select({ id: questsTable.id })
    .from(questsTable)
    .where(eq(questsTable.id, input.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existingQuest) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
  }

  try {
    await db.delete(questsTable).where(eq(questsTable.id, input.questId));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("foreign key")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Quest cannot be deleted because runs reference it."
      });
    }

    throw error;
  }

  return { questId: input.questId };
}
