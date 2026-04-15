import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import { parse } from "jsonc-parser";
import { drizzle } from "drizzle-orm/libsql";

import { quests, runs, users } from "../db/schema";
import type {
  LeaderboardQuestResource,
  LeaderboardRunResource,
  LeaderboardUserResource,
} from "../types/leaderboard";

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

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) return envUrl;

  const envFile = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const match = envFile.match(/^DATABASE_URL=(?:"([^"]+)"|([^\n]+))$/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing from process.env and .env");
  }

  return (match[1] ?? match[2]) as string;
}

const seedUsers =
  readJsonResource<LeaderboardUserResource[]>("mockusers.jsonc");
const seedQuests = readJsonResource<LeaderboardQuestResource[]>("quests.jsonc");
const seedRuns = readJsonResource<LeaderboardRunResource[]>("mockruns.jsonc");

const client = createClient({ url: getDatabaseUrl() });
const db = drizzle(client, {
  schema: { quests, runs, users },
});

async function main() {
  await db.transaction(async (tx) => {
    await tx.delete(runs);
    await tx.delete(quests);

    for (const user of seedUsers) {
      await tx
        .insert(users)
        .values({
          id: user.id,
          name: user.username,
          displayName: user.displayName,
          image: user.image,
          role: user.role,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            name: user.username,
            displayName: user.displayName,
            image: user.image,
            role: user.role,
          },
        });
    }

    await tx.insert(quests).values(
      seedQuests.map((quest) => ({
        id: quest.id,
        slug: quest.slug,
        title: quest.title,
        monster: quest.monster,
        type: quest.type,
        area: quest.areaKey,
        difficultyStars: quest.difficultyStars,
      })),
    );

    await tx.insert(runs).values(
      seedRuns.map((run) => ({
        id: run.id,
        userId: run.userId,
        questId: run.questId,
        hunterName: run.hunterName,
        category: run.category,
        tags: JSON.stringify(run.tags),
        submittedAt: new Date(run.submittedAtMs),
        runTimeMs: run.runTimeMs,
        primaryWeapon: run.primaryWeaponKey,
        secondaryWeapon: run.secondaryWeaponKey,
        approvedByUserId: run.approvedByUserId,
        approvedAt: run.approvedAtMs ? new Date(run.approvedAtMs) : null,
      })),
    );
  });

  console.log(
    `Seeded ${seedUsers.length} users, ${seedQuests.length} quests and ${seedRuns.length} runs.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
