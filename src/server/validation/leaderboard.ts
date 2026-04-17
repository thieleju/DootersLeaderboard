import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";
import { parse } from "jsonc-parser";

import type { LeaderboardCategoryResource } from "~/server/types/leaderboard";

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

const categories =
  readJsonResource<LeaderboardCategoryResource[]>("categories.jsonc");

export const runCategoryValues = categories.map((category) => category.id);

export const leaderboardCategoryFilterValues = [
  "all",
  ...runCategoryValues.filter((categoryId) => categoryId !== "arena")
];

const leaderboardCategoryFilterSet = new Set(leaderboardCategoryFilterValues);

export const leaderboardFiltersSchema = z.object({
  questId: z.string().optional(),
  categoryId: z
    .string()
    .default("all")
    .refine(
      (value) => leaderboardCategoryFilterSet.has(value),
      "Invalid category filter"
    )
});
