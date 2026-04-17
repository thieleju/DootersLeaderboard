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
export const MAX_SUBMIT_SCREENSHOT_BYTES = 1_500_000;
export const MAX_SUBMIT_SCREENSHOT_BASE64_LENGTH = 2_100_000;
const ALLOWED_SCREENSHOT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
] as const;

function getDataUrlPayloadLength(value: string): number {
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) return 0;
  return value.slice(commaIndex + 1).length;
}

function getApproxBase64PayloadBytes(value: string): number {
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) return 0;

  const payload = value.slice(commaIndex + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

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

const screenshotBase64Schema = z
  .string()
  .trim()
  .max(
    MAX_SUBMIT_SCREENSHOT_BASE64_LENGTH,
    `Screenshot payload must be at most ${MAX_SUBMIT_SCREENSHOT_BASE64_LENGTH.toLocaleString("en-US")} characters`
  )
  .regex(
    /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/,
    "Screenshot must be a valid PNG, JPG, or WEBP base64 data URL"
  )
  .refine((value) => {
    const mimeMatch = /^data:([^;]+);base64,/.exec(value);
    return mimeMatch
      ? ALLOWED_SCREENSHOT_MIME_TYPES.includes(
          mimeMatch[1] as (typeof ALLOWED_SCREENSHOT_MIME_TYPES)[number]
        )
      : false;
  }, "Screenshot type must be PNG, JPG, or WEBP")
  .refine(
    (value) => getDataUrlPayloadLength(value) > 0,
    "Screenshot payload is empty"
  )
  .refine(
    (value) =>
      getApproxBase64PayloadBytes(value) <= MAX_SUBMIT_SCREENSHOT_BYTES,
    `Screenshot must be at most ${(MAX_SUBMIT_SCREENSHOT_BYTES / 1_000_000).toFixed(1)} MB`
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
  screenshotBase64: screenshotBase64Schema.optional(),
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
