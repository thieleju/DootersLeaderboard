import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql
} from "drizzle-orm";
import { parse } from "jsonc-parser";

import { db } from "~/server/db";
import {
  botNotificationQueue as botNotificationQueueTable,
  quests as questsTable,
  runs as runsTable,
  users as usersTable
} from "~/server/db/schema";
import type {
  LeaderboardAreaKey,
  LeaderboardAreaResource,
  LeaderboardCategoryOption,
  LeaderboardCategoryResource,
  LeaderboardQuestOption,
  QuestType,
  RunCategoryId,
  UserRole,
  LeaderboardWeaponKey,
  LeaderboardWeaponResource
} from "~/server/types/leaderboard";
import {
  type ModerationHistoryRunRow,
  type ModerationRunRow,
  type PlayerOverviewRow,
  type PlayerProfileData,
  type PlayerProfileRunRow,
  type SubmitRunInput
} from "~/server/types/players";
import type { ScoreAggregate, Top3Placements } from "~/server/types/score";
import { calculateUserScoreAndTop3Placements } from "~/server/lib/score";
import { parseRunTimeInputToMs } from "~/server/lib/run-time";
import {
  MAX_SUBMIT_TAG_LENGTH,
  MAX_SUBMIT_TAGS,
  submitRunInputSchema
} from "~/server/validation/players";

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

const areas = readJsonResource<LeaderboardAreaResource[]>("areas.jsonc");
const weapons = readJsonResource<LeaderboardWeaponResource[]>("weapons.jsonc");
const categories =
  readJsonResource<LeaderboardCategoryResource[]>("categories.jsonc");

const areaByKey = new Map(areas.map((area) => [area.key, area]));
const weaponByKey = new Map(weapons.map((weapon) => [weapon.key, weapon]));

function parseRunTags(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeTags(tags: string[]) {
  const unique = new Set<string>();

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }

  return [...unique];
}

function assertCanModerateRuns(viewerRole: UserRole) {
  if (viewerRole !== "moderator" && viewerRole !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cannot moderate runs" });
  }
}

function assertCategoryAllowedForQuestType(
  category: RunCategoryId,
  questType: QuestType
) {
  const isArenaQuest = questType === "arena";

  if (isArenaQuest && category !== "arena") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arena quests must use arena category"
    });
  }

  if (!isArenaQuest && category === "arena") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arena category can only be used for arena quests"
    });
  }
}

export async function getPlayersOverview(): Promise<PlayerOverviewRow[]> {
  const approvedRuns = await db
    .select({
      runId: runsTable.id,
      userId: runsTable.userId,
      questId: runsTable.questId,
      category: runsTable.category,
      hunterName: runsTable.hunterName,
      submittedAt: runsTable.submittedAt,
      runTimeMs: runsTable.runTimeMs,
      primaryWeapon: runsTable.primaryWeapon,
      secondaryWeapon: runsTable.secondaryWeapon,
      displayName: usersTable.displayName,
      avatar: usersTable.image
    })
    .from(runsTable)
    .innerJoin(usersTable, eq(runsTable.userId, usersTable.id))
    .where(isNotNull(runsTable.approvedByUserId))
    .orderBy(desc(runsTable.submittedAt));

  const submittedRunsCount = new Map<string, number>();
  const weaponUsageByUser = new Map<string, Map<string, number>>();
  const latestSubmittedAtByUser = new Map<string, number>();
  const latestHunterNameByUser = new Map<string, string>();
  const userMeta = new Map<
    string,
    { displayName: string; avatar: string | null }
  >();

  for (const run of approvedRuns) {
    submittedRunsCount.set(
      run.userId,
      (submittedRunsCount.get(run.userId) ?? 0) + 1
    );

    const submittedAtMs =
      run.submittedAt instanceof Date
        ? run.submittedAt.getTime()
        : new Date(run.submittedAt).getTime();

    const latestSubmittedAt = latestSubmittedAtByUser.get(run.userId);
    if (!latestSubmittedAt || submittedAtMs > latestSubmittedAt) {
      latestSubmittedAtByUser.set(run.userId, submittedAtMs);
      latestHunterNameByUser.set(run.userId, run.hunterName);
    }

    const usage =
      weaponUsageByUser.get(run.userId) ?? new Map<string, number>();
    const weaponKeys = new Set(
      [run.primaryWeapon, run.secondaryWeapon].filter((key): key is string =>
        Boolean(key)
      )
    );
    for (const key of weaponKeys) {
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
    weaponUsageByUser.set(run.userId, usage);

    if (!userMeta.has(run.userId)) {
      userMeta.set(run.userId, {
        displayName: run.displayName ?? run.hunterName,
        avatar: run.avatar ?? null
      });
    }
  }

  const { scoreByUser, top3PlacementsByUser } =
    calculateUserScoreAndTop3Placements(approvedRuns);

  const rows: PlayerOverviewRow[] = [...submittedRunsCount.entries()].map(
    ([userId, submittedRuns]) => {
      const usage = weaponUsageByUser.get(userId) ?? new Map<string, number>();
      let mostUsedWeapon: PlayerOverviewRow["mostUsedWeapon"] = null;
      for (const [key, count] of usage.entries()) {
        if (!mostUsedWeapon || count > mostUsedWeapon.count) {
          mostUsedWeapon = {
            key,
            label: weaponByKey.get(key as LeaderboardWeaponKey)?.label ?? key,
            count
          };
        }
      }

      const meta = userMeta.get(userId) ?? {
        displayName: "Unknown Runner",
        avatar: null
      };
      const top3 = top3PlacementsByUser.get(userId) ?? {
        first: 0,
        second: 0,
        third: 0
      };
      const score = scoreByUser.get(userId);

      return {
        userId,
        displayName: meta.displayName,
        avatar: meta.avatar,
        hunterName: latestHunterNameByUser.get(userId) ?? meta.displayName,
        score: score ? score.sum : 0,
        submittedRunsCount: submittedRuns,
        top3Placements: {
          first: top3.first,
          second: top3.second,
          third: top3.third,
          total: top3.first + top3.second + top3.third
        },
        lastSubmittedAtMs: latestSubmittedAtByUser.get(userId) ?? 0,
        mostUsedWeapon
      };
    }
  );

  return rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.top3Placements.total - a.top3Placements.total ||
      a.displayName.localeCompare(b.displayName)
  );
}

export async function getPlayerProfile(
  userId: string,
  viewerUserId?: string,
  viewerRole?: UserRole
): Promise<PlayerProfileData> {
  const user = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.name,
      avatar: usersTable.image,
      role: usersTable.role
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!user) {
    return {
      user: null,
      performance: {
        score: 0,
        top3Placements: { first: 0, second: 0, third: 0 }
      },
      runs: [],
      isCurrentUser: false,
      viewerRole: viewerRole ?? null,
      leaderboardPlacement: null
    };
  }

  const allApprovedRuns = await db
    .select({
      runId: runsTable.id,
      userId: runsTable.userId,
      questId: runsTable.questId,
      category: runsTable.category,
      runTimeMs: runsTable.runTimeMs,
      submittedAt: runsTable.submittedAt,
      approvedByUserId: runsTable.approvedByUserId
    })
    .from(runsTable)
    .where(isNotNull(runsTable.approvedByUserId));

  const scoreCalculation: {
    scoreByUser: Map<string, ScoreAggregate>;
    top3PlacementsByUser: Map<string, Top3Placements>;
    scoreByRunId: Map<string, number>;
    rankByRunId: Map<string, number>;
  } = calculateUserScoreAndTop3Placements(allApprovedRuns);
  const { scoreByUser, top3PlacementsByUser, scoreByRunId, rankByRunId } =
    scoreCalculation;

  const userScore = scoreByUser.get(userId);
  const userPlacements = top3PlacementsByUser.get(userId) ?? {
    first: 0,
    second: 0,
    third: 0
  };
  const leaderboardRows = await getPlayersOverview();
  const leaderboardIndex = leaderboardRows.findIndex(
    (row) => row.userId === userId
  );

  const runRows = await db
    .select({
      runId: runsTable.id,
      hunterName: runsTable.hunterName,
      youtubeLink: sql<string | null>`${runsTable.youtubeLink}`,
      hasScreenshot: sql<number>`case when ${runsTable.screenshotBase64} is null then 0 else 1 end`,
      categoryId: runsTable.category,
      tags: runsTable.tags,
      submittedAt: runsTable.submittedAt,
      runTimeMs: runsTable.runTimeMs,
      primaryWeaponKey: runsTable.primaryWeapon,
      secondaryWeaponKey: runsTable.secondaryWeapon,
      approvedByUserId: runsTable.approvedByUserId,
      approvedAt: runsTable.approvedAt,
      rejectedByUserId: runsTable.rejectedByUserId,
      rejectedAt: runsTable.rejectedAt,
      questTitle: questsTable.title,
      monster: questsTable.monster,
      difficultyStars: questsTable.difficultyStars,
      areaKey: questsTable.area
    })
    .from(runsTable)
    .innerJoin(questsTable, eq(runsTable.questId, questsTable.id))
    .innerJoin(usersTable, eq(runsTable.userId, usersTable.id))
    .where(eq(runsTable.userId, userId))
    .orderBy(desc(runsTable.submittedAt), desc(runsTable.runTimeMs));

  const reviewerUserIds = [
    ...new Set(
      runRows
        .flatMap((run) => [run.approvedByUserId, run.rejectedByUserId])
        .filter((value): value is string => Boolean(value))
    )
  ];

  const reviewerNameById = new Map<string, string>();
  if (reviewerUserIds.length > 0) {
    const reviewerUsers = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        name: usersTable.name
      })
      .from(usersTable)
      .where(inArray(usersTable.id, reviewerUserIds));

    for (const reviewer of reviewerUsers) {
      reviewerNameById.set(
        reviewer.id,
        reviewer.displayName ?? reviewer.name ?? "Moderator"
      );
    }
  }

  const rows: PlayerProfileRunRow[] = runRows.map((run) => {
    const submittedAtMs =
      run.submittedAt instanceof Date
        ? run.submittedAt.getTime()
        : new Date(run.submittedAt).getTime();
    const approvedAtMs = run.approvedAt
      ? run.approvedAt instanceof Date
        ? run.approvedAt.getTime()
        : new Date(run.approvedAt).getTime()
      : null;
    const rejectedAtMs = run.rejectedAt
      ? run.rejectedAt instanceof Date
        ? run.rejectedAt.getTime()
        : new Date(run.rejectedAt).getTime()
      : null;
    const status = run.approvedByUserId
      ? "approved"
      : run.rejectedByUserId
        ? "rejected"
        : "pending";

    return {
      runId: run.runId,
      hunterName: run.hunterName,
      youtubeLink: run.youtubeLink,
      hasScreenshot: Boolean(run.hasScreenshot),
      questTitle: run.questTitle,
      monster: run.monster,
      difficultyStars: run.difficultyStars,
      areaLabel:
        areaByKey.get(run.areaKey as LeaderboardAreaKey)?.label ?? run.areaKey,
      submittedAtMs,
      runTimeMs: run.runTimeMs,
      score: run.approvedByUserId ? (scoreByRunId.get(run.runId) ?? 0) : null,
      rank: run.approvedByUserId ? (rankByRunId.get(run.runId) ?? null) : null,
      categoryId: run.categoryId,
      tagLabels: parseRunTags(run.tags),
      status,
      primaryWeaponKey: run.primaryWeaponKey,
      secondaryWeaponKey: run.secondaryWeaponKey,
      isApproved: Boolean(run.approvedByUserId),
      reviewerDisplayName: run.approvedByUserId
        ? (reviewerNameById.get(run.approvedByUserId) ?? "Moderator")
        : run.rejectedByUserId
          ? (reviewerNameById.get(run.rejectedByUserId) ?? "Moderator")
          : null,
      approvedByDisplayName: run.approvedByUserId
        ? (reviewerNameById.get(run.approvedByUserId) ?? "Moderator")
        : null,
      approvedAtMs,
      rejectedByDisplayName: run.rejectedByUserId
        ? (reviewerNameById.get(run.rejectedByUserId) ?? "Moderator")
        : null,
      rejectedAtMs
    };
  });

  const isCurrentUser = Boolean(viewerUserId && viewerUserId === userId);
  const canSeeReviewerIdentity =
    viewerRole === "moderator" || viewerRole === "admin";
  const canViewPendingRuns = isCurrentUser || canSeeReviewerIdentity;

  const visibleRuns = (
    canViewPendingRuns ? rows : rows.filter((run) => run.status === "approved")
  ).map((run) => {
    if (canSeeReviewerIdentity) {
      return run;
    }

    if (isCurrentUser) {
      return {
        ...run,
        reviewerDisplayName: null,
        approvedByDisplayName: null,
        rejectedByDisplayName: null
      };
    }

    const approvedVisibleAtMs = run.approvedAtMs ?? run.submittedAtMs;
    return {
      ...run,
      submittedAtMs: approvedVisibleAtMs,
      reviewerDisplayName: null,
      approvedByDisplayName: null,
      rejectedByDisplayName: null,
      rejectedAtMs: null
    };
  });

  return {
    user: {
      ...user,
      displayName: user.displayName ?? user.username ?? "Player"
    },
    performance: {
      score: userScore ? userScore.sum : 0,
      top3Placements: userPlacements
    },
    runs: visibleRuns,
    isCurrentUser,
    viewerRole: viewerRole ?? null,
    leaderboardPlacement: leaderboardIndex >= 0 ? leaderboardIndex + 1 : null
  };
}

export async function getSubmitRunOptions() {
  const quests = await db
    .select({
      id: questsTable.id,
      title: questsTable.title,
      monster: questsTable.monster,
      difficultyStars: questsTable.difficultyStars,
      type: questsTable.type,
      areaKey: questsTable.area
    })
    .from(questsTable)
    .orderBy(desc(questsTable.difficultyStars), asc(questsTable.title));

  const rowsWithTags = await db
    .select({ tags: runsTable.tags })
    .from(runsTable)
    .where(
      and(isNotNull(runsTable.approvedByUserId), isNotNull(runsTable.tags))
    );

  const existingTags = new Set<string>();
  for (const row of rowsWithTags) {
    for (const tag of parseRunTags(row.tags)) {
      existingTags.add(tag);
    }
  }

  return {
    quests: quests.map((quest): LeaderboardQuestOption => {
      const areaKey = quest.areaKey as LeaderboardAreaKey;
      return {
        id: quest.id,
        title: quest.title,
        monster: quest.monster,
        type: quest.type,
        areaKey,
        areaLabel: areaByKey.get(areaKey)?.label ?? areaKey,
        difficultyStars: quest.difficultyStars
      };
    }),
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label
    })),
    weapons: weapons.map((weapon) => ({
      key: weapon.key,
      label: weapon.label
    })),
    existingTags: [...existingTags].sort((a, b) => a.localeCompare(b))
  };
}

export function getRunCategories(): LeaderboardCategoryOption[] {
  return categories.map((category) => ({
    id: category.id,
    label: category.label,
    icon: category.icon,
    color: category.color,
    description: category.description,
    link: category.link
  }));
}

export async function getPendingRunsForModeration(
  viewerRole: UserRole
): Promise<ModerationRunRow[]> {
  assertCanModerateRuns(viewerRole);

  const runRows = await db
    .select({
      runId: runsTable.id,
      runnerUserId: runsTable.userId,
      runnerDisplayName: usersTable.displayName,
      runnerAvatar: usersTable.image,
      runnerUsername: usersTable.name,
      hunterName: runsTable.hunterName,
      categoryId: runsTable.category,
      tags: runsTable.tags,
      submittedAt: runsTable.submittedAt,
      runTimeMs: runsTable.runTimeMs,
      hasScreenshot: sql<number>`case when ${runsTable.screenshotBase64} is null then 0 else 1 end`,
      youtubeLink: sql<string | null>`${runsTable.youtubeLink}`,
      primaryWeaponKey: runsTable.primaryWeapon,
      secondaryWeaponKey: runsTable.secondaryWeapon,
      questTitle: questsTable.title,
      monster: questsTable.monster,
      difficultyStars: questsTable.difficultyStars,
      areaKey: questsTable.area
    })
    .from(runsTable)
    .innerJoin(questsTable, eq(runsTable.questId, questsTable.id))
    .innerJoin(usersTable, eq(runsTable.userId, usersTable.id))
    .where(
      and(
        isNull(runsTable.approvedByUserId),
        isNull(runsTable.rejectedByUserId)
      )
    )
    .orderBy(desc(runsTable.submittedAt), desc(runsTable.runTimeMs));

  return runRows.map((run) => ({
    runId: run.runId,
    runnerUserId: run.runnerUserId,
    runnerDisplayName: run.runnerDisplayName ?? run.runnerUsername ?? "Runner",
    runnerAvatar: run.runnerAvatar,
    hunterName: run.hunterName,
    questTitle: run.questTitle,
    monster: run.monster,
    difficultyStars: run.difficultyStars,
    areaLabel:
      areaByKey.get(run.areaKey as LeaderboardAreaKey)?.label ?? run.areaKey,
    submittedAtMs:
      run.submittedAt instanceof Date
        ? run.submittedAt.getTime()
        : new Date(run.submittedAt).getTime(),
    runTimeMs: run.runTimeMs,
    hasScreenshot: Boolean(run.hasScreenshot),
    youtubeLink: run.youtubeLink,
    categoryId: run.categoryId,
    tagLabels: parseRunTags(run.tags),
    primaryWeaponKey: run.primaryWeaponKey,
    secondaryWeaponKey: run.secondaryWeaponKey
  }));
}

export async function updatePendingRunTags(
  input: { runId: string; tags: string[] },
  viewerRole: UserRole
) {
  assertCanModerateRuns(viewerRole);

  const run = await db
    .select({
      id: runsTable.id,
      questId: runsTable.questId,
      approvedByUserId: runsTable.approvedByUserId,
      rejectedByUserId: runsTable.rejectedByUserId
    })
    .from(runsTable)
    .where(eq(runsTable.id, input.runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }

  if (run.approvedByUserId || run.rejectedByUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only pending runs can be edited"
    });
  }

  const tags = normalizeTags(input.tags);

  if (tags.length > MAX_SUBMIT_TAGS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `You can add at most ${MAX_SUBMIT_TAGS} tags`
    });
  }

  for (const tag of tags) {
    if (tag.length > MAX_SUBMIT_TAG_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters`
      });
    }
  }

  await db
    .update(runsTable)
    .set({ tags: tags.length > 0 ? JSON.stringify(tags) : "null" })
    .where(eq(runsTable.id, input.runId));

  return { runId: input.runId };
}

export async function updatePendingRunDetails(
  input: {
    runId: string;
    category: RunCategoryId;
    primaryWeaponKey: string;
    secondaryWeaponKey: string;
    youtubeLink?: string;
    screenshotBase64?: string | null;
    tags: string[];
  },
  viewerRole: UserRole
) {
  assertCanModerateRuns(viewerRole);

  const run = await db
    .select({
      id: runsTable.id,
      questId: runsTable.questId,
      approvedByUserId: runsTable.approvedByUserId,
      rejectedByUserId: runsTable.rejectedByUserId
    })
    .from(runsTable)
    .where(eq(runsTable.id, input.runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }

  if (run.approvedByUserId || run.rejectedByUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only pending runs can be edited"
    });
  }

  if (!categories.some((category) => category.id === input.category)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid category" });
  }

  const quest = await db
    .select({ type: questsTable.type })
    .from(questsTable)
    .where(eq(questsTable.id, run.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!quest) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quest" });
  }

  assertCategoryAllowedForQuestType(input.category, quest.type);

  if (!weaponByKey.has(input.primaryWeaponKey as LeaderboardWeaponKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid primary weapon"
    });
  }

  if (!weaponByKey.has(input.secondaryWeaponKey as LeaderboardWeaponKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid secondary weapon"
    });
  }

  const tags = normalizeTags(input.tags);
  const youtubeLink = input.youtubeLink?.trim()
    ? input.youtubeLink.trim()
    : null;
  const updateData: {
    category: RunCategoryId;
    primaryWeapon: string;
    secondaryWeapon: string;
    youtubeLink: string | null;
    tags: string;
    screenshotBase64?: string | null;
  } = {
    category: input.category,
    primaryWeapon: input.primaryWeaponKey,
    secondaryWeapon: input.secondaryWeaponKey,
    youtubeLink,
    tags: tags.length > 0 ? JSON.stringify(tags) : "null"
  };

  if ("screenshotBase64" in input) {
    if (viewerRole !== "admin" && viewerRole !== "moderator") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only moderators and admins can edit screenshots"
      });
    }

    updateData.screenshotBase64 = input.screenshotBase64 ?? null;
  }

  if (tags.length > MAX_SUBMIT_TAGS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `You can add at most ${MAX_SUBMIT_TAGS} tags`
    });
  }

  for (const tag of tags) {
    if (tag.length > MAX_SUBMIT_TAG_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters`
      });
    }
  }

  await db
    .update(runsTable)
    .set(updateData)
    .where(eq(runsTable.id, input.runId));

  return { runId: input.runId };
}

export async function updateReviewedRunDetails(input: {
  runId: string;
  category: RunCategoryId;
  primaryWeaponKey: string;
  secondaryWeaponKey: string;
  youtubeLink?: string;
  screenshotBase64?: string | null;
  tags: string[];
}) {
  const run = await db
    .select({
      id: runsTable.id,
      questId: runsTable.questId,
      approvedByUserId: runsTable.approvedByUserId,
      rejectedByUserId: runsTable.rejectedByUserId
    })
    .from(runsTable)
    .where(eq(runsTable.id, input.runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }

  if (!run.approvedByUserId && !run.rejectedByUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only reviewed runs can be edited"
    });
  }

  if (!categories.some((category) => category.id === input.category)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid category" });
  }

  const quest = await db
    .select({ type: questsTable.type })
    .from(questsTable)
    .where(eq(questsTable.id, run.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!quest) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quest" });
  }

  assertCategoryAllowedForQuestType(input.category, quest.type);

  if (!weaponByKey.has(input.primaryWeaponKey as LeaderboardWeaponKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid primary weapon"
    });
  }

  if (!weaponByKey.has(input.secondaryWeaponKey as LeaderboardWeaponKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid secondary weapon"
    });
  }

  const tags = normalizeTags(input.tags);
  const youtubeLink = input.youtubeLink?.trim()
    ? input.youtubeLink.trim()
    : null;
  const updateData: {
    category: RunCategoryId;
    primaryWeapon: string;
    secondaryWeapon: string;
    youtubeLink: string | null;
    tags: string;
    screenshotBase64?: string | null;
  } = {
    category: input.category,
    primaryWeapon: input.primaryWeaponKey,
    secondaryWeapon: input.secondaryWeaponKey,
    youtubeLink,
    tags: tags.length > 0 ? JSON.stringify(tags) : "null"
  };

  if ("screenshotBase64" in input) {
    updateData.screenshotBase64 = input.screenshotBase64 ?? null;
  }

  if (tags.length > MAX_SUBMIT_TAGS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `You can add at most ${MAX_SUBMIT_TAGS} tags`
    });
  }

  for (const tag of tags) {
    if (tag.length > MAX_SUBMIT_TAG_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters`
      });
    }
  }

  await db
    .update(runsTable)
    .set(updateData)
    .where(eq(runsTable.id, input.runId));

  return { runId: input.runId };
}

export async function getReviewedRunsForModeration(
  viewerRole: UserRole
): Promise<ModerationHistoryRunRow[]> {
  assertCanModerateRuns(viewerRole);

  const runRows = await db
    .select({
      runId: runsTable.id,
      runnerUserId: runsTable.userId,
      runnerDisplayName: usersTable.displayName,
      runnerAvatar: usersTable.image,
      runnerUsername: usersTable.name,
      hunterName: runsTable.hunterName,
      categoryId: runsTable.category,
      tags: runsTable.tags,
      submittedAt: runsTable.submittedAt,
      runTimeMs: runsTable.runTimeMs,
      hasScreenshot: sql<number>`case when ${runsTable.screenshotBase64} is null then 0 else 1 end`,
      youtubeLink: sql<string | null>`${runsTable.youtubeLink}`,
      primaryWeaponKey: runsTable.primaryWeapon,
      secondaryWeaponKey: runsTable.secondaryWeapon,
      approvedByUserId: runsTable.approvedByUserId,
      approvedAt: runsTable.approvedAt,
      rejectedByUserId: runsTable.rejectedByUserId,
      rejectedAt: runsTable.rejectedAt,
      questTitle: questsTable.title,
      monster: questsTable.monster,
      difficultyStars: questsTable.difficultyStars,
      areaKey: questsTable.area
    })
    .from(runsTable)
    .innerJoin(questsTable, eq(runsTable.questId, questsTable.id))
    .innerJoin(usersTable, eq(runsTable.userId, usersTable.id))
    .where(
      or(
        isNotNull(runsTable.approvedByUserId),
        isNotNull(runsTable.rejectedByUserId)
      )
    )
    .orderBy(desc(runsTable.submittedAt), desc(runsTable.runTimeMs));

  const reviewerUserIds = [
    ...new Set(
      runRows
        .flatMap((run) => [run.approvedByUserId, run.rejectedByUserId])
        .filter((value): value is string => Boolean(value))
    )
  ];

  const reviewerNameById = new Map<string, string>();
  if (reviewerUserIds.length > 0) {
    const reviewerUsers = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        name: usersTable.name
      })
      .from(usersTable)
      .where(inArray(usersTable.id, reviewerUserIds));

    for (const reviewer of reviewerUsers) {
      reviewerNameById.set(
        reviewer.id,
        reviewer.displayName ?? reviewer.name ?? "Moderator"
      );
    }
  }

  return runRows.map((run) => ({
    runId: run.runId,
    runnerUserId: run.runnerUserId,
    runnerDisplayName: run.runnerDisplayName ?? run.runnerUsername ?? "Runner",
    runnerAvatar: run.runnerAvatar,
    hunterName: run.hunterName,
    questTitle: run.questTitle,
    monster: run.monster,
    difficultyStars: run.difficultyStars,
    areaLabel:
      areaByKey.get(run.areaKey as LeaderboardAreaKey)?.label ?? run.areaKey,
    submittedAtMs:
      run.submittedAt instanceof Date
        ? run.submittedAt.getTime()
        : new Date(run.submittedAt).getTime(),
    runTimeMs: run.runTimeMs,
    hasScreenshot: Boolean(run.hasScreenshot),
    youtubeLink: run.youtubeLink,
    categoryId: run.categoryId,
    tagLabels: parseRunTags(run.tags),
    status: run.approvedByUserId ? "approved" : "rejected",
    reviewerDisplayName: run.approvedByUserId
      ? (reviewerNameById.get(run.approvedByUserId) ?? "Moderator")
      : run.rejectedByUserId
        ? (reviewerNameById.get(run.rejectedByUserId) ?? "Moderator")
        : null,
    approvedAtMs: run.approvedAt
      ? run.approvedAt instanceof Date
        ? run.approvedAt.getTime()
        : new Date(run.approvedAt).getTime()
      : null,
    rejectedAtMs: run.rejectedAt
      ? run.rejectedAt instanceof Date
        ? run.rejectedAt.getTime()
        : new Date(run.rejectedAt).getTime()
      : null,
    primaryWeaponKey: run.primaryWeaponKey,
    secondaryWeaponKey: run.secondaryWeaponKey
  }));
}

export async function submitRun(input: SubmitRunInput, userId: string) {
  const parsed = submitRunInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", cause: parsed.error });
  }

  const value = parsed.data;

  const quest = await db
    .select({ id: questsTable.id, type: questsTable.type })
    .from(questsTable)
    .where(eq(questsTable.id, value.questId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!quest) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quest" });
  }

  assertCategoryAllowedForQuestType(value.category, quest.type);

  if (!weaponByKey.has(value.primaryWeaponKey as LeaderboardWeaponKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid primary weapon"
    });
  }

  const secondaryWeaponKey = value.secondaryWeaponKey?.trim() || null;
  if (
    secondaryWeaponKey &&
    !weaponByKey.has(secondaryWeaponKey as LeaderboardWeaponKey)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid secondary weapon"
    });
  }

  const tags = normalizeTags(value.tags);
  const valueRecord = value as Record<string, unknown>;
  const youtubeLink =
    typeof valueRecord.youtubeLink === "string"
      ? valueRecord.youtubeLink
      : null;
  const screenshotBase64 =
    typeof valueRecord.screenshotBase64 === "string"
      ? valueRecord.screenshotBase64
      : null;

  const runId = crypto.randomUUID();
  await db.insert(runsTable).values({
    id: runId,
    userId,
    questId: value.questId,
    hunterName: value.hunterName,
    category: value.category,
    tags: tags.length > 0 ? JSON.stringify(tags) : "null",
    youtubeLink,
    screenshotBase64,
    submittedAt: new Date(),
    runTimeMs: parseRunTimeInputToMs(value.runTime),
    primaryWeapon: value.primaryWeaponKey,
    secondaryWeapon: secondaryWeaponKey,
    approvedByUserId: null,
    approvedAt: null,
    rejectedByUserId: null,
    rejectedAt: null
  });

  // Queue bot notification for run submission
  await db.insert(botNotificationQueueTable).values({
    eventKey: "run_submitted",
    runId,
    questId: value.questId,
    userId,
    dataJson: JSON.stringify({
      runId,
      questId: value.questId,
      hunterName: value.hunterName,
      category: value.category,
      youtubeLink,
      hasScreenshot: screenshotBase64 ? "yes" : "no",
      runTimeMs: parseRunTimeInputToMs(value.runTime),
      primaryWeapon: value.primaryWeaponKey,
      secondaryWeapon: secondaryWeaponKey
    })
  });

  return { runId };
}

export async function deleteRun(
  runId: string,
  viewerUserId: string,
  viewerRole: UserRole
) {
  const run = await db
    .select({
      id: runsTable.id,
      userId: runsTable.userId,
      approvedByUserId: runsTable.approvedByUserId
    })
    .from(runsTable)
    .where(eq(runsTable.id, runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }

  const isAdmin = viewerRole === "admin";
  const isOwner = run.userId === viewerUserId;
  const canDeleteRun = isAdmin || (isOwner && !run.approvedByUserId);

  if (!canDeleteRun) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete run" });
  }

  // Remove queued/sent bot notifications linked to this run first to avoid FK errors.
  await db.transaction(async (tx) => {
    await tx
      .delete(botNotificationQueueTable)
      .where(eq(botNotificationQueueTable.runId, runId));

    await tx.delete(runsTable).where(eq(runsTable.id, runId));
  });

  return { runId };
}

export async function rejectRun(
  runId: string,
  viewerUserId: string,
  viewerRole: UserRole
) {
  const canModerateRuns = viewerRole === "moderator" || viewerRole === "admin";
  if (!canModerateRuns) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reject run" });
  }

  const run = await db
    .select({
      id: runsTable.id,
      questId: runsTable.questId,
      userId: runsTable.userId,
      approvedByUserId: runsTable.approvedByUserId
    })
    .from(runsTable)
    .where(eq(runsTable.id, runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }

  if (viewerRole === "moderator" && run.userId === viewerUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Moderators cannot reject their own runs"
    });
  }

  await db
    .update(runsTable)
    .set({
      approvedByUserId: null,
      approvedAt: null,
      rejectedByUserId: viewerUserId,
      rejectedAt: new Date()
    })
    .where(eq(runsTable.id, runId));

  const reviewer = await db
    .select({ displayName: usersTable.displayName, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, viewerUserId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const rejectedByName = reviewer?.displayName ?? reviewer?.name ?? "Moderator";

  await db.insert(botNotificationQueueTable).values({
    eventKey: "run_rejected",
    runId,
    questId: run.questId,
    userId: run.userId,
    dataJson: JSON.stringify({
      runId,
      questId: run.questId,
      userId: run.userId,
      rejectedByUserId: viewerUserId,
      rejectedByName
    })
  });

  return { runId };
}

export async function approveRun(
  runId: string,
  viewerUserId: string,
  viewerRole: UserRole
) {
  const canModerateRuns = viewerRole === "moderator" || viewerRole === "admin";
  if (!canModerateRuns) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cannot approve run" });
  }

  const run = await db
    .select({
      id: runsTable.id,
      questId: runsTable.questId,
      userId: runsTable.userId,
      approvedByUserId: runsTable.approvedByUserId
    })
    .from(runsTable)
    .where(eq(runsTable.id, runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }

  if (viewerRole === "moderator" && run.userId === viewerUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Moderators cannot approve their own runs"
    });
  }

  if (run.approvedByUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Run is already approved"
    });
  }

  await db
    .update(runsTable)
    .set({
      approvedByUserId: viewerUserId,
      approvedAt: new Date(),
      rejectedByUserId: null,
      rejectedAt: null
    })
    .where(eq(runsTable.id, runId));

  const reviewer = await db
    .select({ displayName: usersTable.displayName, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, viewerUserId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const approvedByName = reviewer?.displayName ?? reviewer?.name ?? "Moderator";

  await db.insert(botNotificationQueueTable).values({
    eventKey: "run_approved",
    runId,
    questId: run.questId,
    userId: run.userId,
    dataJson: JSON.stringify({
      runId,
      questId: run.questId,
      userId: run.userId,
      approvedByUserId: viewerUserId,
      approvedByName
    })
  });

  return { runId };
}

export async function getRunScreenshot(
  runId: string
): Promise<{ screenshotBase64: string | null }> {
  const run = await db
    .select({
      screenshotBase64: runsTable.screenshotBase64
    })
    .from(runsTable)
    .where(eq(runsTable.id, runId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!run) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Run not found"
    });
  }

  return {
    screenshotBase64: run.screenshotBase64
  };
}
