import { z } from "zod";

export const questTypeValues = [
  "event",
  "optional",
  "arena",
  "investigation"
] as const;

export const questAreaValues = [
  "plains",
  "forest",
  "basin",
  "cliffs",
  "wyveria",
  "arena",
  "other"
] as const;

export const questUpsertInputSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(255),
  monster: z.string().trim().min(2, "Monster is required").max(255),
  areaKey: z.enum(questAreaValues),
  difficultyStars: z
    .number({ invalid_type_error: "Difficulty stars must be a number" })
    .int("Difficulty stars must be a whole number")
    .min(1, "Difficulty stars must be at least 1")
    .max(10, "Difficulty stars must be at most 10")
});

export const questCreateInputSchema = questUpsertInputSchema;

export const questUpdateInputSchema = questUpsertInputSchema.extend({
  questId: z.string().trim().min(1, "Quest id is required")
});

export const questDeleteInputSchema = z.object({
  questId: z.string().trim().min(1, "Quest id is required")
});
