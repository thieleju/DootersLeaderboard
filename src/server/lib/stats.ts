import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { asc, desc, eq, isNotNull } from "drizzle-orm";
import { parse } from "jsonc-parser";

import { db } from "~/server/db";
import {
  quests as questsTable,
  runs as runsTable,
  users as usersTable,
} from "~/server/db/schema";
import type { LeaderboardWeaponResource } from "~/server/types/leaderboard";
import type { HomeStats } from "~/server/types/stats";
import { calculateUserScoreAndTop3Placements } from "~/server/lib/score";

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

const weapons = readJsonResource<LeaderboardWeaponResource[]>("weapons.jsonc");
const weaponByKey = new Map(weapons.map((weapon) => [weapon.key, weapon]));

export async function getHomeStats(): Promise<HomeStats> {
  const uploadedRuns = await db
    .select({
      userId: runsTable.userId,
      primaryWeaponKey: runsTable.primaryWeapon,
      secondaryWeaponKey: runsTable.secondaryWeapon,
    })
    .from(runsTable)
    .where(isNotNull(runsTable.approvedByUserId));

  const uploadedRunCount = uploadedRuns.length;
  const activeRunnerCount = new Set(uploadedRuns.map((run) => run.userId)).size;

  const weaponUsageCount = new Map<string, number>();
  for (const run of uploadedRuns) {
    const weaponKeys = new Set(
      [run.primaryWeaponKey, run.secondaryWeaponKey].filter(
        (weaponKey): weaponKey is string => Boolean(weaponKey),
      ),
    );

    for (const weaponKey of weaponKeys) {
      weaponUsageCount.set(
        weaponKey,
        (weaponUsageCount.get(weaponKey) ?? 0) + 1,
      );
    }
  }

  let mostPlayedWeapon: HomeStats["mostPlayedWeapon"] = null;
  for (const [key, count] of weaponUsageCount.entries()) {
    if (!mostPlayedWeapon || count > mostPlayedWeapon.count) {
      const label =
        weaponByKey.get(key as LeaderboardWeaponResource["key"])?.label ?? key;
      mostPlayedWeapon = { key, label, count };
    }
  }

  const quests = await db
    .select({ id: questsTable.id })
    .from(questsTable)
    .orderBy(desc(questsTable.difficultyStars), asc(questsTable.title));
  const questById = new Set(quests.map((quest) => quest.id));

  const runRows = await db
    .select({
      userId: runsTable.userId,
      questId: runsTable.questId,
      submittedAt: runsTable.submittedAt,
      runTimeMs: runsTable.runTimeMs,
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

  const approvedRuns = runRows.filter(
    (row) => row.approvedAt !== null && questById.has(row.questId),
  );

  const { scoreByUser } = calculateUserScoreAndTop3Placements(approvedRuns);

  const placements = new Map<
    string,
    {
      userId: string;
      userName: string;
      userImage: string | null;
      scoreSum: number;
      scoredQuestCount: number;
      score: number;
    }
  >();

  for (const run of approvedRuns) {
    const score = scoreByUser.get(run.userId);
    if (!score) continue;

    const existing = placements.get(run.userId) ?? {
      userId: run.userId,
      userName: run.userName ?? "Unknown Runner",
      userImage: run.userImage ?? null,
      scoreSum: 0,
      scoredQuestCount: 0,
      score: 0,
    };

    existing.scoreSum = score.sum;
    existing.scoredQuestCount = score.count;
    existing.score = score.sum;

    placements.set(run.userId, existing);
  }

  const topRunnerRecord = [...placements.values()].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.scoredQuestCount !== a.scoredQuestCount) {
      return b.scoredQuestCount - a.scoredQuestCount;
    }
    return a.userName.localeCompare(b.userName);
  })[0];

  return {
    activeRunnerCount,
    uploadedRunCount,
    mostPlayedWeapon,
    topRunner: topRunnerRecord
      ? {
          userId: topRunnerRecord.userId,
          userName: topRunnerRecord.userName,
          userImage: topRunnerRecord.userImage,
          score: topRunnerRecord.score,
        }
      : null,
  };
}
