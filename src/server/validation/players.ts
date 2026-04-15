import { z } from "zod";

import { RUN_TIME_INPUT_REGEX } from "~/server/lib/run-time";
import { runCategoryValues } from "~/server/validation/leaderboard";

export const submitRunInputSchema = z.object({
  questId: z.string().min(1, "Quest is required"),
  hunterName: z
    .string()
    .trim()
    .min(2, "Hunter name is required")
    .max(40, "Hunter name is too long"),
  runTime: z
    .string()
    .trim()
    .regex(RUN_TIME_INPUT_REGEX, "Run time must match mm:ss.cc"),
  category: z.enum(runCategoryValues).default("fs"),
  primaryWeaponKey: z.string().min(1, "Primary weapon is required"),
  secondaryWeaponKey: z.string().min(1, "Secondary weapon is required"),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
