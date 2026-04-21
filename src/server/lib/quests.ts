import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { TRPCError } from "@trpc/server";
import { asc, eq, isNotNull } from "drizzle-orm";
import { parse } from "jsonc-parser";

import { db } from "~/server/db";
import {
  botNotificationQueue as botNotificationQueueTable,
  quests as questsTable,
  runs as runsTable,
  users as usersTable
} from "~/server/db/schema";
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
  optional: "Optional",
  arena: "Arena",
  event: "Event",
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
  // Get all quests
  const questRows = await db
    .select({
      id: questsTable.id,
      title: questsTable.title,
      monster: questsTable.monster,
      type: questsTable.type,
      areaKey: questsTable.area,
      difficultyStars: questsTable.difficultyStars
    })
    .from(questsTable);

  // Get all approved runs with necessary fields to count best per player/category
  const approvedRunRows = await db
    .select({
      questId: runsTable.questId,
      userId: runsTable.userId,
      category: runsTable.category,
      runTimeMs: runsTable.runTimeMs,
      submittedAt: runsTable.submittedAt
    })
    .from(runsTable)
    .where(isNotNull(runsTable.approvedByUserId))
    .orderBy(
      asc(runsTable.questId),
      asc(runsTable.runTimeMs),
      asc(runsTable.submittedAt)
    );

  // Keep only best run per player per category per quest
  const bestRunByQuestUserCategory = new Map<
    string,
    (typeof approvedRunRows)[number]
  >();
  for (const run of approvedRunRows) {
    const key = `${run.questId}:${run.userId}:${run.category}`;
    if (!bestRunByQuestUserCategory.has(key)) {
      bestRunByQuestUserCategory.set(key, run);
    }
  }

  // Count best runs per quest and track unique users per quest
  const approvedRunCountByQuestId = new Map<string, number>();
  const approverUserIdsByQuestId = new Map<string, Set<string>>();
  for (const run of bestRunByQuestUserCategory.values()) {
    const currentCount = approvedRunCountByQuestId.get(run.questId) ?? 0;
    approvedRunCountByQuestId.set(run.questId, currentCount + 1);

    const userIds =
      approverUserIdsByQuestId.get(run.questId) ?? new Set<string>();
    userIds.add(run.userId);
    approverUserIdsByQuestId.set(run.questId, userIds);
  }

  // Get user names for all approvers
  const allApproverUserIds = Array.from(
    new Set(
      Array.from(approverUserIdsByQuestId.values()).flatMap((set) =>
        Array.from(set)
      )
    )
  );

  const userNameById = new Map<string, string>();
  if (allApproverUserIds.length > 0) {
    const users = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        name: usersTable.name
      })
      .from(usersTable);

    for (const user of users) {
      const displayName = user.displayName ?? user.name ?? "Unknown";
      userNameById.set(user.id, displayName);
    }
  }

  return questRows.map((row) => {
    const areaKey = row.areaKey as QuestManagementRow["areaKey"];
    const approverIds =
      approverUserIdsByQuestId.get(row.id) ?? new Set<string>();
    const approvers = Array.from(approverIds)
      .map((userId) => ({
        userId,
        name: userNameById.get(userId) ?? "Unknown"
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: row.id,
      title: row.title,
      monster: row.monster,
      type: row.type,
      areaKey,
      areaLabel: areaLabelByKey.get(areaKey) ?? areaKey,
      difficultyStars: row.difficultyStars,
      approvedRunCount: approvedRunCountByQuestId.get(row.id) ?? 0,
      approvers
    };
  });
}

export async function createQuest(input: QuestUpsertInput) {
  const questId = crypto.randomUUID();

  await db.insert(questsTable).values({
    id: questId,
    title: input.title,
    monster: input.monster,
    type: input.type,
    area: input.areaKey,
    difficultyStars: input.difficultyStars
  });

  await db.insert(botNotificationQueueTable).values({
    eventKey: "quest_modified",
    questId,
    dataJson: JSON.stringify({
      action: "created",
      questId,
      title: input.title,
      monster: input.monster,
      type: input.type,
      areaKey: input.areaKey,
      difficultyStars: input.difficultyStars
    })
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
      type: input.type,
      area: input.areaKey,
      difficultyStars: input.difficultyStars
    })
    .where(eq(questsTable.id, input.questId));

  await db.insert(botNotificationQueueTable).values({
    eventKey: "quest_modified",
    questId: input.questId,
    dataJson: JSON.stringify({
      action: "updated",
      questId: input.questId,
      title: input.title,
      monster: input.monster,
      type: input.type,
      areaKey: input.areaKey,
      difficultyStars: input.difficultyStars
    })
  });

  return { questId: input.questId };
}

export async function deleteQuest(input: { questId: string }) {
  const existingQuest = await db
    .select({
      id: questsTable.id,
      title: questsTable.title,
      monster: questsTable.monster,
      type: questsTable.type,
      areaKey: questsTable.area,
      difficultyStars: questsTable.difficultyStars
    })
    .from(questsTable)
    .where(eq(questsTable.id, input.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existingQuest) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
  }

  const referencingRun = await db
    .select({ id: runsTable.id })
    .from(runsTable)
    .where(eq(runsTable.questId, input.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (referencingRun) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Quest cannot be deleted because runs reference it."
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(botNotificationQueueTable)
        .where(eq(botNotificationQueueTable.questId, input.questId));

      await tx.delete(questsTable).where(eq(questsTable.id, input.questId));
    });
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

  await db.insert(botNotificationQueueTable).values({
    eventKey: "quest_modified",
    dataJson: JSON.stringify({
      action: "deleted",
      questId: existingQuest.id,
      title: existingQuest.title,
      monster: existingQuest.monster,
      type: existingQuest.type,
      areaKey: existingQuest.areaKey,
      difficultyStars: existingQuest.difficultyStars
    })
  });

  return { questId: input.questId };
}
