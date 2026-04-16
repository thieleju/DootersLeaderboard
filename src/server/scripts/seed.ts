import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import { parse } from "jsonc-parser";
import { drizzle } from "drizzle-orm/libsql";
import { eq, inArray } from "drizzle-orm";

import { quests, runs, users } from "../db/schema";
import type {
  LeaderboardAreaResource,
  LeaderboardCategoryResource,
  LeaderboardQuestResource,
  LeaderboardRunResource,
  LeaderboardUserResource,
  LeaderboardWeaponResource
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
  const parsed: unknown = parse(fileContents);
  if (parsed === undefined) {
    throw new Error(`Failed to parse JSONC resource: ${fileName}`);
  }

  return parsed as T;
}

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) return envUrl;

  const envFile = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const databaseUrlRegex = /^DATABASE_URL=(?:"([^"]+)"|([^\n]+))$/m;
  const match = databaseUrlRegex.exec(envFile);
  if (!match) {
    throw new Error("DATABASE_URL is missing from process.env and .env");
  }

  return match[1] ?? match[2]!;
}

function toQuestSeedKey(title: string) {
  return `q_${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

function validateResources(params: {
  areas: LeaderboardAreaResource[];
  categories: LeaderboardCategoryResource[];
  weapons: LeaderboardWeaponResource[];
  quests: LeaderboardQuestResource[];
  users: LeaderboardUserResource[];
  runs: LeaderboardRunResource[];
}) {
  const { areas, categories, weapons, quests, users, runs } = params;

  const areaKeys = new Set(areas.map((area) => area.key));
  const categoryIds = new Set(categories.map((category) => category.id));
  const weaponKeys = new Set(weapons.map((weapon) => weapon.key));
  const questKeys = new Set(quests.map((quest) => toQuestSeedKey(quest.title)));
  const userIds = new Set(users.map((user) => user.id));

  for (const quest of quests) {
    if (!areaKeys.has(quest.areaKey)) {
      throw new Error(
        `Quest ${quest.title} references unknown areaKey: ${quest.areaKey}`
      );
    }
  }

  const errors: string[] = [];

  for (const run of runs) {
    if (!questKeys.has(run.questId)) {
      errors.push(`Run ${run.id} references unknown questId: ${run.questId}`);
    }
    if (!userIds.has(run.userId)) {
      errors.push(`Run ${run.id} references unknown userId: ${run.userId}`);
    }
    if (run.approvedByUserId && !userIds.has(run.approvedByUserId)) {
      errors.push(
        `Run ${run.id} references unknown approvedByUserId: ${run.approvedByUserId}`
      );
    }
    if (!categoryIds.has(run.category)) {
      errors.push(`Run ${run.id} references unknown category: ${run.category}`);
    }
    if (!weaponKeys.has(run.primaryWeaponKey)) {
      errors.push(
        `Run ${run.id} references unknown primaryWeaponKey: ${run.primaryWeaponKey}`
      );
    }
    if (run.secondaryWeaponKey && !weaponKeys.has(run.secondaryWeaponKey)) {
      errors.push(
        `Run ${run.id} references unknown secondaryWeaponKey: ${run.secondaryWeaponKey}`
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
  schema: { quests, runs, users }
});

async function main() {
  const mode = parseSeedMode(process.argv.slice(2));
  const isDemoMode = mode === "demo";

  const seedAreas = readJsonResource<LeaderboardAreaResource[]>("areas.jsonc");
  const seedCategories =
    readJsonResource<LeaderboardCategoryResource[]>("categories.jsonc");
  const seedWeapons =
    readJsonResource<LeaderboardWeaponResource[]>("weapons.jsonc");
  const seedUsers = isDemoMode
    ? readJsonResource<LeaderboardUserResource[]>("mocks/mockusers.jsonc")
    : [];
  const seedQuests =
    readJsonResource<LeaderboardQuestResource[]>("quests.jsonc");
  const seedRuns = isDemoMode
    ? readJsonResource<LeaderboardRunResource[]>("mocks/mockruns.jsonc")
    : [];

  validateResources({
    areas: seedAreas,
    categories: seedCategories,
    weapons: seedWeapons,
    quests: seedQuests,
    users: seedUsers,
    runs: seedRuns
  });

  await db.transaction(async (tx) => {
    if (isDemoMode) {
      await tx.delete(runs);
    }

    for (const user of seedUsers) {
      const baseUserValues = {
        id: user.id,
        name: user.username,
        displayName: user.displayName,
        image: user.image,
        role: user.role
      };

      if (isDemoMode) {
        await tx
          .insert(users)
          .values(baseUserValues)
          .onConflictDoUpdate({
            target: users.id,
            set: {
              name: user.username,
              displayName: user.displayName,
              image: user.image,
              role: user.role
            }
          });
        continue;
      }

      await tx.insert(users).values(baseUserValues).onConflictDoNothing({
        target: users.id
      });
    }

    const existingQuestRows = await tx
      .select({ id: quests.id, title: quests.title })
      .from(quests)
      .where(
        inArray(
          quests.title,
          seedQuests.map((quest) => quest.title)
        )
      );

    const existingQuestIdByTitle = new Map(
      existingQuestRows.map((quest) => [quest.title, quest.id])
    );

    for (const quest of seedQuests) {
      const existingQuestId = existingQuestIdByTitle.get(quest.title);

      if (existingQuestId) {
        await tx
          .update(quests)
          .set({
            monster: quest.monster,
            type: quest.type,
            area: quest.areaKey,
            difficultyStars: quest.difficultyStars
          })
          .where(eq(quests.id, existingQuestId));
        continue;
      }

      await tx.insert(quests).values({
        title: quest.title,
        monster: quest.monster,
        type: quest.type,
        area: quest.areaKey,
        difficultyStars: quest.difficultyStars
      });
    }

    const seededQuestRows = await tx
      .select({ id: quests.id, title: quests.title })
      .from(quests)
      .where(
        inArray(
          quests.title,
          seedQuests.map((quest) => quest.title)
        )
      );

    const seededQuestIdByTitle = new Map(
      seededQuestRows.map((quest) => [quest.title, quest.id])
    );
    const questTitleBySeedKey = new Map(
      seedQuests.map((quest) => [toQuestSeedKey(quest.title), quest.title])
    );

    const resolvedRunValues = seedRuns.map((run) => {
      const questTitle = questTitleBySeedKey.get(run.questId);
      if (!questTitle) {
        throw new Error(
          `Run ${run.id} references unknown quest seed key: ${run.questId}`
        );
      }

      const resolvedQuestId = seededQuestIdByTitle.get(questTitle);
      if (!resolvedQuestId) {
        throw new Error(
          `Could not resolve quest id for run ${run.id} and title '${questTitle}'`
        );
      }

      return {
        id: run.id,
        userId: run.userId,
        questId: resolvedQuestId,
        hunterName: run.hunterName,
        category: run.category,
        tags: JSON.stringify(run.tags),
        submittedAt: new Date(run.submittedAtMs),
        runTimeMs: run.runTimeMs,
        primaryWeapon: run.primaryWeaponKey,
        secondaryWeapon: run.secondaryWeaponKey,
        approvedByUserId: run.approvedByUserId,
        approvedAt: run.approvedAtMs ? new Date(run.approvedAtMs) : null
      };
    });

    if (resolvedRunValues.length > 0) {
      if (isDemoMode) {
        await tx.insert(runs).values(resolvedRunValues);
      } else {
        await tx.insert(runs).values(resolvedRunValues).onConflictDoNothing({
          target: runs.id
        });
      }
    }
  });

  if (isDemoMode) {
    console.log(
      `[seed:demo] Loaded ${seedAreas.length} areas, ${seedCategories.length} categories, ${seedWeapons.length} weapons, ${seedUsers.length} users, ${seedQuests.length} quests and ${seedRuns.length} runs.`
    );
  } else {
    console.log(
      `[seed:production] Loaded ${seedAreas.length} areas, ${seedCategories.length} categories, ${seedWeapons.length} weapons and ${seedQuests.length} quests (mockusers/mockruns skipped).`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
