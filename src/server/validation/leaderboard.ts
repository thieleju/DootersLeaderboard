import { z } from "zod";

export const runCategoryValues = ["fs", "rr", "ta-wiki"] as const;

export const leaderboardCategoryFilterValues = [
  "all",
  ...runCategoryValues,
] as const;

export const leaderboardFiltersSchema = z.object({
  questSlug: z.string().optional(),
  categoryId: z.enum(leaderboardCategoryFilterValues).default("all"),
});
