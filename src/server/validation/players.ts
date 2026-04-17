import { z } from "zod";

import { extractYouTubeVideoId } from "~/lib/youtube";
import {
  RUN_TIME_INPUT_REGEX,
  isValidRunTimeRange
} from "~/server/validation/run-time";

export const MAX_SUBMIT_TAGS = 10;
export const MAX_SUBMIT_TAG_LENGTH = 15;
export const MAX_SUBMIT_HUNTER_NAME_LENGTH = 40;
export const MAX_SUBMIT_YOUTUBE_LINK_LENGTH = 2048;

const youtubeLinkSchema = z
  .string()
  .trim()
  .max(
    MAX_SUBMIT_YOUTUBE_LINK_LENGTH,
    `YouTube link must be at most ${MAX_SUBMIT_YOUTUBE_LINK_LENGTH} characters`
  )
  .url("YouTube link must be a valid URL")
  .refine(
    (value) => extractYouTubeVideoId(value) !== null,
    "YouTube link must point to a valid YouTube video"
  );

export const submitRunInputSchema = z.object({
  questId: z.string().trim().min(1, "Quest is required"),
  hunterName: z
    .string()
    .trim()
    .min(2, "Hunter name is required")
    .max(
      MAX_SUBMIT_HUNTER_NAME_LENGTH,
      `Hunter name must be at most ${MAX_SUBMIT_HUNTER_NAME_LENGTH} characters`
    ),
  runTime: z
    .string()
    .trim()
    .regex(RUN_TIME_INPUT_REGEX, "Run time must match mm'ss\"cc")
    .refine(
      isValidRunTimeRange,
      "Run time must be between 00'01\"00 and 50'00\"00"
    ),
  category: z.string().trim().min(1, "Category is required").default("fs"),
  primaryWeaponKey: z.string().trim().min(1, "Primary weapon is required"),
  secondaryWeaponKey: z.string().trim().min(1, "Secondary weapon is required"),
  youtubeLink: youtubeLinkSchema.optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .max(
          MAX_SUBMIT_TAG_LENGTH,
          `Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters`
        )
    )
    .max(MAX_SUBMIT_TAGS, `You can add at most ${MAX_SUBMIT_TAGS} tags`)
    .optional()
    .default([])
});

export const moderateRunTagsInputSchema = z.object({
  runId: z.string().trim().min(1, "Run id is required"),
  tags: z
    .array(
      z
        .string()
        .trim()
        .max(
          MAX_SUBMIT_TAG_LENGTH,
          `Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters`
        )
    )
    .max(MAX_SUBMIT_TAGS, `You can add at most ${MAX_SUBMIT_TAGS} tags`)
    .optional()
    .default([])
});

export const moderateRunDetailsInputSchema = z.object({
  runId: z.string().trim().min(1, "Run id is required"),
  category: z.string().trim().min(1, "Category is required"),
  primaryWeaponKey: z.string().trim().min(1, "Primary weapon is required"),
  secondaryWeaponKey: z.string().trim().min(1, "Secondary weapon is required"),
  youtubeLink: youtubeLinkSchema.optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .max(
          MAX_SUBMIT_TAG_LENGTH,
          `Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters`
        )
    )
    .max(MAX_SUBMIT_TAGS, `You can add at most ${MAX_SUBMIT_TAGS} tags`)
    .optional()
    .default([])
});
