import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { asc, desc, eq } from "drizzle-orm";
import { parse } from "jsonc-parser";

import { db } from "~/server/db";
import {
  quests as questsTable,
  runs as runsTable,
  users as usersTable,
} from "~/server/db/schema";
import type { LeaderboardWeaponResource } from "~/server/types/leaderboard";

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

const weapons = readJsonResource<LeaderboardWeaponResource[]>("weapons.jsonc");
const weaponByKey = new Map(weapons.map((weapon) => [weapon.key, weapon]));

export interface HomeStats {
  activeRunnerCount: number;
  uploadedRunCount: number;
  mostPlayedWeapon: {
    key: string;
    label: string;
    count: number;
  } | null;
  topRunner: {
    userId: string;
    userName: string;
    userImage: string | null;
    firstPlaceCount: number;
    podiumCount: number;
    totalPlacedCount: number;
    bestRank: number;
  } | null;
}

export async function getHomeStats(): Promise<HomeStats> {
  const uploadedRuns = await db
    .select({
      userId: runsTable.userId,
      primaryWeaponKey: runsTable.primaryWeapon,
      secondaryWeaponKey: runsTable.secondaryWeapon,
    })
    .from(runsTable);

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

  const bestRunByQuestAndUser = new Map<
    string,
    (typeof approvedRuns)[number]
  >();
  for (const run of approvedRuns) {
    const key = `${run.questId}:${run.userId}`;
    if (!bestRunByQuestAndUser.has(key)) {
      bestRunByQuestAndUser.set(key, run);
    }
  }

  const rowsByQuestId = new Map<string, (typeof approvedRuns)[number][]>();
  for (const run of bestRunByQuestAndUser.values()) {
    const runsForQuest = rowsByQuestId.get(run.questId) ?? [];
    runsForQuest.push(run);
    rowsByQuestId.set(run.questId, runsForQuest);
  }

  const placements = new Map<
    string,
    {
      userId: string;
      userName: string;
      userImage: string | null;
      firstPlaceCount: number;
      podiumCount: number;
      totalPlacedCount: number;
      bestRank: number;
      rankScore: number;
    }
  >();

  for (const runsForQuest of rowsByQuestId.values()) {
    const ranked = runsForQuest
      .slice()
      .sort(
        (a, b) =>
          a.runTimeMs - b.runTimeMs ||
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );

    ranked.forEach((run, index) => {
      const rank = index + 1;
      const existing = placements.get(run.userId) ?? {
        userId: run.userId,
        userName: run.userName ?? "Unknown Runner",
        userImage: run.userImage ?? null,
        firstPlaceCount: 0,
        podiumCount: 0,
        totalPlacedCount: 0,
        bestRank: Number.POSITIVE_INFINITY,
        rankScore: 0,
      };

      existing.totalPlacedCount += 1;
      existing.bestRank = Math.min(existing.bestRank, rank);
      if (rank === 1) existing.firstPlaceCount += 1;
      if (rank <= 3) {
        existing.podiumCount += 1;
        existing.rankScore += 4 - rank;
      }

      placements.set(run.userId, existing);
    });
  }

  const topRunnerRecord = [...placements.values()].sort((a, b) => {
    if (b.firstPlaceCount !== a.firstPlaceCount) {
      return b.firstPlaceCount - a.firstPlaceCount;
    }
    if (b.podiumCount !== a.podiumCount) {
      return b.podiumCount - a.podiumCount;
    }
    if (b.rankScore !== a.rankScore) {
      return b.rankScore - a.rankScore;
    }
    if (b.totalPlacedCount !== a.totalPlacedCount) {
      return b.totalPlacedCount - a.totalPlacedCount;
    }
    if (a.bestRank !== b.bestRank) {
      return a.bestRank - b.bestRank;
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
          firstPlaceCount: topRunnerRecord.firstPlaceCount,
          podiumCount: topRunnerRecord.podiumCount,
          totalPlacedCount: topRunnerRecord.totalPlacedCount,
          bestRank: topRunnerRecord.bestRank,
        }
      : null,
  };
}
