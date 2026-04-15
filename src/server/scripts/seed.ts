import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import { parse } from "jsonc-parser";
import { drizzle } from "drizzle-orm/libsql";

import { quests, runs, users } from "../db/schema";
import type {
  LeaderboardAreaResource,
  LeaderboardCategoryResource,
  LeaderboardQuestResource,
  LeaderboardRunResource,
  LeaderboardUserResource,
  LeaderboardWeaponResource,
} from "../types/leaderboard";

const resourceDir = path.join(process.cwd(), "src/server/resources");

type SeedMode = "demo" | "production";

function parseSeedMode(argv: string[]): SeedMode {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  if (modeArg) {
    const mode = modeArg.slice("--mode=".length);
    if (mode === "demo" || mode === "production") return mode;
    throw new Error(`Invalid --mode value: ${mode}. Use demo or production.`);
  }

  if (argv.includes("--production")) return "production";
  if (argv.includes("--demo")) return "demo";
  return "demo";
}

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

function validateResources(params: {
  areas: LeaderboardAreaResource[];
  categories: LeaderboardCategoryResource[];
  weapons: LeaderboardWeaponResource[];
  quests: LeaderboardQuestResource[];
  users: LeaderboardUserResource[];
  runs: LeaderboardRunResource[];
  mode: SeedMode;
}) {
  const { areas, categories, weapons, quests, users, runs, mode } = params;

  const areaKeys = new Set(areas.map((area) => area.key));
  const categoryIds = new Set(categories.map((category) => category.id));
  const weaponKeys = new Set(weapons.map((weapon) => weapon.key));
  const questIds = new Set(quests.map((quest) => quest.id));
  const userIds = new Set(users.map((user) => user.id));

  for (const quest of quests) {
    if (!areaKeys.has(quest.areaKey)) {
      throw new Error(
        `Quest ${quest.id} references unknown areaKey: ${quest.areaKey}`,
      );
    }
  }

  if (mode === "production") return;

  const errors: string[] = [];

  for (const run of runs) {
    if (!questIds.has(run.questId)) {
      errors.push(`Run ${run.id} references unknown questId: ${run.questId}`);
    }
    if (!userIds.has(run.userId)) {
      errors.push(`Run ${run.id} references unknown userId: ${run.userId}`);
    }
    if (run.approvedByUserId && !userIds.has(run.approvedByUserId)) {
      errors.push(
        `Run ${run.id} references unknown approvedByUserId: ${run.approvedByUserId}`,
      );
    }
    if (!categoryIds.has(run.category)) {
      errors.push(`Run ${run.id} references unknown category: ${run.category}`);
    }
    if (!weaponKeys.has(run.primaryWeaponKey)) {
      errors.push(
        `Run ${run.id} references unknown primaryWeaponKey: ${run.primaryWeaponKey}`,
      );
    }
    if (run.secondaryWeaponKey && !weaponKeys.has(run.secondaryWeaponKey)) {
      errors.push(
        `Run ${run.id} references unknown secondaryWeaponKey: ${run.secondaryWeaponKey}`,
      );
    }
  }

  if (errors.length > 0) {
    const preview = errors.slice(0, 12).join("\n");
    const suffix =
      errors.length > 12 ? `\n...and ${errors.length - 12} more` : "";
    throw new Error(`Resource validation failed:\n${preview}${suffix}`);
  }
}

const client = createClient({ url: getDatabaseUrl() });
const db = drizzle(client, {
  schema: { quests, runs, users },
});

async function main() {
  const mode = parseSeedMode(process.argv.slice(2));
  const isDemoMode = mode === "demo";

  const seedAreas = readJsonResource<LeaderboardAreaResource[]>("areas.jsonc");
  const seedCategories =
    readJsonResource<LeaderboardCategoryResource[]>("categories.jsonc");
  const seedWeapons =
    readJsonResource<LeaderboardWeaponResource[]>("weapons.jsonc");
  const seedUsers =
    readJsonResource<LeaderboardUserResource[]>("mockusers.jsonc");
  const seedQuests =
    readJsonResource<LeaderboardQuestResource[]>("quests.jsonc");
  const seedRuns = readJsonResource<LeaderboardRunResource[]>("mockruns.jsonc");

  validateResources({
    areas: seedAreas,
    categories: seedCategories,
    weapons: seedWeapons,
    quests: seedQuests,
    users: seedUsers,
    runs: seedRuns,
    mode,
  });

  await db.transaction(async (tx) => {
    await tx.delete(runs);
    await tx.delete(quests);

    if (isDemoMode) {
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
    }

    await tx.insert(quests).values(
      seedQuests.map((quest) => ({
        id: quest.id,
        slug: quest.id,
        title: quest.title,
        monster: quest.monster,
        type: quest.type,
        area: quest.areaKey,
        difficultyStars: quest.difficultyStars,
      })),
    );

    if (isDemoMode) {
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
    }
  });

  if (isDemoMode) {
    console.log(
      `[seed:demo] Loaded ${seedAreas.length} areas, ${seedCategories.length} categories, ${seedWeapons.length} weapons, ${seedUsers.length} users, ${seedQuests.length} quests and ${seedRuns.length} runs.`,
    );
  } else {
    console.log(
      `[seed:production] Loaded ${seedAreas.length} areas, ${seedCategories.length} categories, ${seedWeapons.length} weapons and ${seedQuests.length} quests (mockusers/mockruns skipped).`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
