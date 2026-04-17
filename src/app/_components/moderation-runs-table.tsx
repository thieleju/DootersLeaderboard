"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sword,
  Tag,
  Trash2,
  X
} from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import type {
  LeaderboardCategoryOption,
  LeaderboardWeaponResource,
  RunCategoryId
} from "~/server/types/leaderboard";

import { extractYouTubeVideoId } from "~/lib/youtube";
import { api } from "~/trpc/react";
import {
  MAX_SUBMIT_TAG_LENGTH,
  MAX_SUBMIT_TAGS,
  MAX_SUBMIT_YOUTUBE_LINK_LENGTH
} from "~/server/validation/players";
import AnimatedCard from "./animated-card";
import CategoryTooltip from "./category-tooltip";
import DataTable, {
  DataTableLoadingState,
  getRelativeTime
} from "./data-table";
import { capitalizeFirst, formatFullDateTime, formatRunTime } from "./helpers";
import { categoryToneClasses } from "./theme-classes";

type ModerationRunsTableProps = {
  delay?: number;
  onInitialReady?: () => void;
};

type PendingRunRow = Pick<
  {
    runId: string;
    runnerUserId: string;
    runnerDisplayName: string;
    runnerAvatar: string | null;
    hunterName: string;
    questTitle: string;
    monster: string;
    difficultyStars: number;
    areaLabel: string;
    submittedAtMs: number;
    runTimeMs: number;
    youtubeLink: string | null;
    screenshotBase64: string | null;
    categoryId: RunCategoryId;
    tagLabels: string[];
    primaryWeaponKey: string;
    secondaryWeaponKey: string | null;
  },
  | "runId"
  | "runnerUserId"
  | "runnerDisplayName"
  | "runnerAvatar"
  | "hunterName"
  | "questTitle"
  | "monster"
  | "difficultyStars"
  | "areaLabel"
  | "submittedAtMs"
  | "runTimeMs"
  | "youtubeLink"
  | "screenshotBase64"
  | "categoryId"
  | "tagLabels"
  | "primaryWeaponKey"
  | "secondaryWeaponKey"
>;

type ReviewedRunRow = Pick<
  {
    runId: string;
    runnerUserId: string;
    runnerDisplayName: string;
    runnerAvatar: string | null;
    hunterName: string;
    questTitle: string;
    monster: string;
    difficultyStars: number;
    areaLabel: string;
    submittedAtMs: number;
    runTimeMs: number;
    youtubeLink: string | null;
    screenshotBase64: string | null;
    categoryId: RunCategoryId;
    tagLabels: string[];
    status: "approved" | "rejected";
    reviewerDisplayName: string | null;
    approvedAtMs: number | null;
    rejectedAtMs: number | null;
    primaryWeaponKey: string;
    secondaryWeaponKey: string | null;
  },
  | "runId"
  | "runnerUserId"
  | "runnerDisplayName"
  | "runnerAvatar"
  | "hunterName"
  | "questTitle"
  | "monster"
  | "difficultyStars"
  | "areaLabel"
  | "submittedAtMs"
  | "runTimeMs"
  | "youtubeLink"
  | "screenshotBase64"
  | "categoryId"
  | "tagLabels"
  | "status"
  | "reviewerDisplayName"
  | "approvedAtMs"
  | "rejectedAtMs"
  | "primaryWeaponKey"
  | "secondaryWeaponKey"
>;

const categoryIconMap = {
  flame: Flame,
  shield: Shield,
  "book-open": BookOpen,
  sword: Sword
} as const;

const defaultRunCategory = {
  label: "Unknown",
  icon: "flame" as const,
  color: "cyan" as const,
  tone: "cyan" as const,
  description: "",
  link: null
};

function statusBadge(status: "pending" | "approved" | "rejected") {
  if (status === "approved") {
    return "border-emerald-300/30 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border-rose-300/30 bg-rose-400/10 text-rose-300";
  }

  return "border-amber-300/30 bg-amber-400/10 text-amber-300";
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asWeapons(value: unknown): LeaderboardWeaponResource[] {
  if (!value || typeof value !== "object") return [];
  return asArray<LeaderboardWeaponResource>(
    (value as { weapons?: unknown }).weapons
  );
}

function asExistingTags(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return asArray<string>((value as { existingTags?: unknown }).existingTags);
}

export default function ModerationRunsTable({
  delay = 0,
  onInitialReady
}: ModerationRunsTableProps) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const pendingRunsQuery = api.players.pendingRuns.useQuery(undefined, {
    staleTime: 10_000
  });
  const reviewedRunsQuery = api.players.reviewedRuns.useQuery(undefined, {
    staleTime: 10_000
  });
  const categoriesQuery = api.players.categories.useQuery(undefined, {
    staleTime: Infinity
  });
  const submitOptionsQuery = api.players.submitOptions.useQuery(undefined, {
    staleTime: Infinity
  });

  const [expandedPendingRunId, setExpandedPendingRunId] = useState<
    string | null
  >(null);
  const [expandedReviewedRunId, setExpandedReviewedRunId] = useState<
    string | null
  >(null);
  const [processingRunId, setProcessingRunId] = useState<string | null>(null);
  const [savingRunId, setSavingRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);

  const [tagInputByRunId, setTagInputByRunId] = useState<
    Record<string, string>
  >({});
  const [tagDraftByRunId, setTagDraftByRunId] = useState<
    Record<string, string[]>
  >({});
  const [categoryDraftByRunId, setCategoryDraftByRunId] = useState<
    Record<string, PendingRunRow["categoryId"]>
  >({});
  const [primaryWeaponDraftByRunId, setPrimaryWeaponDraftByRunId] = useState<
    Record<string, string>
  >({});
  const [secondaryWeaponDraftByRunId, setSecondaryWeaponDraftByRunId] =
    useState<Record<string, string>>({});
  const [youtubeLinkDraftByRunId, setYoutubeLinkDraftByRunId] = useState<
    Record<string, string>
  >({});

  const pendingRuns = useMemo<PendingRunRow[]>(
    () => asArray<PendingRunRow>(pendingRunsQuery.data),
    [pendingRunsQuery.data]
  );
  const reviewedRuns = useMemo<ReviewedRunRow[]>(
    () => asArray<ReviewedRunRow>(reviewedRunsQuery.data),
    [reviewedRunsQuery.data]
  );
  const categoryOptions = useMemo<LeaderboardCategoryOption[]>(
    () => asArray<LeaderboardCategoryOption>(categoriesQuery.data),
    [categoriesQuery.data]
  );
  const weapons = useMemo<LeaderboardWeaponResource[]>(
    () => asWeapons(submitOptionsQuery.data),
    [submitOptionsQuery.data]
  );
  const existingTags = useMemo<string[]>(
    () => asExistingTags(submitOptionsQuery.data),
    [submitOptionsQuery.data]
  );
  const viewerUserId = session?.user?.id ?? null;
  const viewerRole = session?.user?.role ?? null;
  const isAdmin = viewerRole === "admin";

  useEffect(() => {
    if (
      !onInitialReady ||
      pendingRunsQuery.isLoading ||
      reviewedRunsQuery.isLoading ||
      categoriesQuery.isLoading ||
      submitOptionsQuery.isLoading
    ) {
      return;
    }

    const timeout = window.setTimeout(() => onInitialReady(), 420);
    return () => window.clearTimeout(timeout);
  }, [
    categoriesQuery.isLoading,
    onInitialReady,
    pendingRunsQuery.isLoading,
    reviewedRunsQuery.isLoading,
    submitOptionsQuery.isLoading
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdownKey &&
        !(event.target as HTMLElement).closest(
          '[role="button"], [role="listbox"]'
        )
      ) {
        setOpenDropdownKey(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdownKey]);

  const categoryById = useMemo(() => {
    return new Map<
      string,
      {
        label: string;
        icon: LeaderboardCategoryOption["icon"];
        color: LeaderboardCategoryOption["color"];
        tone: LeaderboardCategoryOption["color"];
        description: string;
        link: string | null;
      }
    >(
      categoryOptions.map((category) => [
        category.id,
        {
          label: category.label,
          icon: category.icon,
          color: category.color,
          tone: category.color,
          description: category.description,
          link: category.link
        }
      ])
    );
  }, [categoryOptions]);

  const refreshAll = async () => {
    await Promise.all([
      utils.players.pendingRuns.invalidate(),
      utils.players.reviewedRuns.invalidate(),
      utils.players.profile.invalidate(),
      utils.players.list.invalidate(),
      utils.players.submitOptions.invalidate(),
      utils.leaderboard.filters.invalidate(),
      utils.leaderboard.getLeaderboard.invalidate(),
      utils.stats.getHomeStats.invalidate()
    ]);
  };

  const approveRunMutation = api.players.approveRun.useMutation({
    onSuccess: async () => {
      setProcessingRunId(null);
      setRunError(null);
      await refreshAll();
    },
    onError: (error: unknown) => {
      setProcessingRunId(null);
      setRunError(
        error instanceof Error
          ? (error.message ?? "Could not approve run.")
          : "Could not approve run."
      );
    }
  });

  const rejectRunMutation = api.players.rejectRun.useMutation({
    onSuccess: async () => {
      setProcessingRunId(null);
      setRunError(null);
      await refreshAll();
    },
    onError: (error: unknown) => {
      setProcessingRunId(null);
      setRunError(
        error instanceof Error
          ? (error.message ?? "Could not reject run.")
          : "Could not reject run."
      );
    }
  });

  const updateRunDetailsMutation =
    api.players.updatePendingRunDetails.useMutation({
      onSuccess: async () => {
        setSavingRunId(null);
        setRunError(null);
        setOpenDropdownKey(null);
        await refreshAll();
      },
      onError: (error: unknown) => {
        setSavingRunId(null);
        setRunError(
          error instanceof Error
            ? (error.message ?? "Could not update pending run.")
            : "Could not update pending run."
        );
      }
    });

  const updateReviewedRunDetailsMutation =
    api.players.updateReviewedRunDetails.useMutation({
      onSuccess: async () => {
        setSavingRunId(null);
        setRunError(null);
        setOpenDropdownKey(null);
        await refreshAll();
      },
      onError: (error: unknown) => {
        setSavingRunId(null);
        setRunError(
          error instanceof Error
            ? (error.message ?? "Could not update reviewed run.")
            : "Could not update reviewed run."
        );
      }
    });

  const deleteRunMutation = api.players.deleteRun.useMutation({
    onSuccess: async () => {
      setProcessingRunId(null);
      setRunError(null);
      await refreshAll();
    },
    onError: (error: unknown) => {
      setProcessingRunId(null);
      setRunError(
        error instanceof Error
          ? (error.message ?? "Could not delete run.")
          : "Could not delete run."
      );
    }
  });

  const ensureDrafts = (run: PendingRunRow | ReviewedRunRow) => {
    setTagDraftByRunId((current) => {
      if (current[run.runId]) return current;
      return { ...current, [run.runId]: [...run.tagLabels] };
    });

    setCategoryDraftByRunId((current) => {
      if (current[run.runId]) return current;
      return { ...current, [run.runId]: run.categoryId };
    });

    setPrimaryWeaponDraftByRunId((current) => {
      if (current[run.runId]) return current;
      return { ...current, [run.runId]: run.primaryWeaponKey };
    });

    setSecondaryWeaponDraftByRunId((current) => {
      if (current[run.runId]) return current;
      return {
        ...current,
        [run.runId]: run.secondaryWeaponKey ?? run.primaryWeaponKey
      };
    });

    setYoutubeLinkDraftByRunId((current) => {
      if (current[run.runId] !== undefined) return current;
      return { ...current, [run.runId]: run.youtubeLink ?? "" };
    });
  };

  const resetDrafts = (run: PendingRunRow | ReviewedRunRow) => {
    setTagDraftByRunId((current) => ({
      ...current,
      [run.runId]: [...run.tagLabels]
    }));
    setCategoryDraftByRunId((current) => ({
      ...current,
      [run.runId]: run.categoryId
    }));
    setPrimaryWeaponDraftByRunId((current) => ({
      ...current,
      [run.runId]: run.primaryWeaponKey
    }));
    setSecondaryWeaponDraftByRunId((current) => ({
      ...current,
      [run.runId]: run.secondaryWeaponKey ?? run.primaryWeaponKey
    }));
    setYoutubeLinkDraftByRunId((current) => ({
      ...current,
      [run.runId]: run.youtubeLink ?? ""
    }));
    setTagInputByRunId((current) => ({ ...current, [run.runId]: "" }));
    setOpenDropdownKey(null);
  };

  const addTag = (runId: string) => {
    const nextTag = (tagInputByRunId[runId] ?? "").trim();
    addTagValue(runId, nextTag);
    setTagInputByRunId((current) => ({ ...current, [runId]: "" }));
  };

  const addTagValue = (runId: string, rawTag: string) => {
    const nextTag = rawTag.trim();
    if (!nextTag) return;

    if (nextTag.length > MAX_SUBMIT_TAG_LENGTH) {
      setRunError(`Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters.`);
      return;
    }

    setTagDraftByRunId((current) => {
      const tags = current[runId] ?? [];
      if (tags.includes(nextTag)) return current;
      if (tags.length >= MAX_SUBMIT_TAGS) {
        setRunError(`You can add at most ${MAX_SUBMIT_TAGS} tags.`);
        return current;
      }

      setRunError(null);
      return { ...current, [runId]: [...tags, nextTag] };
    });
  };

  const removeTag = (runId: string, tag: string) => {
    setTagDraftByRunId((current) => ({
      ...current,
      [runId]: (current[runId] ?? []).filter((existing) => existing !== tag)
    }));
  };

  const getCategoryMeta = (
    categoryId: string
  ): {
    label: string;
    icon: LeaderboardCategoryOption["icon"];
    color: LeaderboardCategoryOption["color"];
    tone: LeaderboardCategoryOption["color"];
    description: string;
    link: string | null;
  } => {
    return (
      categoryById.get(categoryId) ?? {
        label: categoryId,
        icon: defaultRunCategory.icon,
        color: defaultRunCategory.color,
        tone: defaultRunCategory.tone,
        description: defaultRunCategory.description,
        link: defaultRunCategory.link
      }
    );
  };

  const hasRunDraftChanges = (
    run: PendingRunRow | ReviewedRunRow,
    draftTags: string[],
    draftCategoryId: string,
    draftPrimaryWeaponKey: string,
    draftSecondaryWeaponKey: string,
    draftYoutubeLink: string
  ) => {
    const tagsChanged =
      draftTags.length !== run.tagLabels.length ||
      draftTags.some((tag, idx) => tag !== run.tagLabels[idx]);

    return (
      tagsChanged ||
      draftCategoryId !== run.categoryId ||
      draftPrimaryWeaponKey !== run.primaryWeaponKey ||
      draftYoutubeLink.trim() !== (run.youtubeLink ?? "") ||
      draftSecondaryWeaponKey !==
        (run.secondaryWeaponKey ?? run.primaryWeaponKey)
    );
  };

  const isValidYoutubeDraft = (value: string) => {
    const trimmed = value.trim();
    return !trimmed || extractYouTubeVideoId(trimmed) !== null;
  };

  return (
    <div className="space-y-6">
      <AnimatedCard
        delay={delay}
        className="relative z-30 p-6 shadow-2xl shadow-black/20"
      >
        <DataTable
          title="Pending Runs"
          description="Review, edit and moderate pending run submissions."
          icon={<Clock3 className="h-6 w-6" />}
          iconColor="amber"
          tableWrapperClassName="overflow-visible"
          columns={[
            { key: "status", label: "Status" },
            { key: "runner", label: "Runner" },
            { key: "quest", label: "Quest" },
            { key: "time", label: "Time" },
            { key: "submitted", label: "Submitted" },
            { key: "actions", label: "Actions", className: "text-left" }
          ]}
        >
          {pendingRunsQuery.isLoading ? (
            <DataTableLoadingState
              columnCount={6}
              label="Loading pending runs..."
            />
          ) : (
            <motion.tbody
              key="moderation-pending-runs-rows"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {pendingRuns.map((run, index) => {
                const isExpanded = expandedPendingRunId === run.runId;
                const isOwnRun = Boolean(
                  viewerUserId && viewerUserId === run.runnerUserId
                );
                const canModerateThisRun = isAdmin || !isOwnRun;
                const submittedLabel = capitalizeFirst(
                  getRelativeTime(run.submittedAtMs)
                );
                const submittedDateTimeLabel = formatFullDateTime(
                  run.submittedAtMs
                );

                const draftTags = tagDraftByRunId[run.runId] ?? run.tagLabels;
                const draftCategoryId: PendingRunRow["categoryId"] =
                  categoryDraftByRunId[run.runId] ?? run.categoryId;
                const draftPrimaryWeaponKey =
                  primaryWeaponDraftByRunId[run.runId] ?? run.primaryWeaponKey;
                const draftSecondaryWeaponKey =
                  secondaryWeaponDraftByRunId[run.runId] ??
                  run.secondaryWeaponKey ??
                  run.primaryWeaponKey;
                const draftYoutubeLink =
                  youtubeLinkDraftByRunId[run.runId] ?? run.youtubeLink ?? "";

                const hasChanges = hasRunDraftChanges(
                  run,
                  draftTags,
                  draftCategoryId,
                  draftPrimaryWeaponKey,
                  draftSecondaryWeaponKey,
                  draftYoutubeLink
                );

                const category = getCategoryMeta(draftCategoryId);

                return (
                  <AnimatePresence key={run.runId} initial={false}>
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      className={`group cursor-pointer border-b border-gray-800/70 text-sm transition-colors ${
                        isExpanded ? "bg-white/6" : "hover:bg-white/5"
                      }`}
                      onClick={() => {
                        setExpandedPendingRunId((current) =>
                          current === run.runId ? null : run.runId
                        );
                        ensureDrafts(run);
                      }}
                    >
                      <td className="px-3 py-4 align-middle">
                        <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">
                          Pending
                        </span>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="inline-flex items-center gap-3 text-gray-200">
                          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5">
                            {run.runnerAvatar ? (
                              <Image
                                src={run.runnerAvatar}
                                alt={run.runnerDisplayName}
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="inline-flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                                {run.runnerDisplayName
                                  .trim()
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">
                              {run.runnerDisplayName}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {run.hunterName}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="flex min-w-0 items-start gap-2">
                          <ChevronDown
                            className={`mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-amber-300" : ""
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {run.questTitle}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {run.difficultyStars}★ {run.monster} ·{" "}
                              {run.areaLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-left align-middle">
                        <div className="text-lg font-semibold text-white">
                          {formatRunTime(run.runTimeMs)}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="text-sm font-semibold text-white">
                          {submittedLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {submittedDateTimeLabel}
                        </div>
                      </td>
                      <td
                        className="px-3 py-4 text-left align-middle"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {canModerateThisRun ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={processingRunId === run.runId}
                              onClick={() => {
                                setRunError(null);
                                setProcessingRunId(run.runId);
                                approveRunMutation.mutate({ runId: run.runId });
                              }}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-400/10 text-emerald-100 transition-colors hover:border-emerald-200 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Approve run"
                              title="Approve run"
                            >
                              {processingRunId === run.runId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={processingRunId === run.runId}
                              onClick={() => {
                                setRunError(null);
                                setProcessingRunId(run.runId);
                                rejectRunMutation.mutate({ runId: run.runId });
                              }}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-rose-300/30 bg-rose-400/10 text-rose-100 transition-colors hover:border-rose-200 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Reject run"
                              title="Reject run"
                            >
                              {processingRunId === run.runId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    </motion.tr>

                    {isExpanded ? (
                      <motion.tr
                        key={`${run.runId}-details`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-visible border-b border-gray-800/70"
                      >
                        <td
                          colSpan={6}
                          className="overflow-visible px-0 py-0 align-top"
                        >
                          <motion.div
                            initial={{
                              maxHeight: 0,
                              opacity: 0,
                              pointerEvents: "none"
                            }}
                            animate={{
                              maxHeight: 2000,
                              opacity: 1,
                              pointerEvents: "auto"
                            }}
                            exit={{
                              maxHeight: 0,
                              opacity: 0,
                              pointerEvents: "none"
                            }}
                            transition={{ duration: 0.24, ease: "easeOut" }}
                            className="overflow-visible"
                          >
                            <div className="grid gap-4 overflow-visible bg-gray-900 px-4 py-4 md:grid-cols-3">
                              <div className="space-y-1">
                                <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                  Category
                                </span>
                                <div className="relative">
                                  <button
                                    type="button"
                                    role="button"
                                    onClick={() =>
                                      setOpenDropdownKey((current) =>
                                        current === `${run.runId}:category`
                                          ? null
                                          : `${run.runId}:category`
                                      )
                                    }
                                    className="relative w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                                  >
                                    <span className="block truncate">
                                      {category.label}
                                    </span>
                                    <ChevronDown
                                      className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                                        openDropdownKey ===
                                        `${run.runId}:category`
                                          ? "rotate-180 text-amber-300"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                  {openDropdownKey ===
                                  `${run.runId}:category` ? (
                                    <motion.div
                                      role="listbox"
                                      initial={{
                                        opacity: 0,
                                        y: -4,
                                        scale: 0.99
                                      }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -4, scale: 0.99 }}
                                      transition={{ duration: 0.16 }}
                                      className="absolute top-full right-0 z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                                    >
                                      {categoryOptions.map((categoryOption) => (
                                        <button
                                          key={categoryOption.id}
                                          type="button"
                                          role="option"
                                          aria-selected={
                                            draftCategoryId ===
                                            categoryOption.id
                                          }
                                          onClick={() => {
                                            setCategoryDraftByRunId(
                                              (current) => ({
                                                ...current,
                                                [run.runId]: categoryOption.id
                                              })
                                            );
                                            setOpenDropdownKey(null);
                                          }}
                                          className={`flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                            draftCategoryId ===
                                            categoryOption.id
                                              ? "bg-amber-400/15 text-amber-100"
                                              : "text-gray-200 hover:bg-white/7"
                                          }`}
                                        >
                                          {categoryOption.label}
                                        </button>
                                      ))}
                                    </motion.div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                  Primary Weapon
                                </span>
                                <div className="relative">
                                  <button
                                    type="button"
                                    role="button"
                                    onClick={() =>
                                      setOpenDropdownKey((current) =>
                                        current === `${run.runId}:primary`
                                          ? null
                                          : `${run.runId}:primary`
                                      )
                                    }
                                    className="relative w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                                  >
                                    <span className="block truncate">
                                      {weapons.find(
                                        (weapon) =>
                                          weapon.key === draftPrimaryWeaponKey
                                      )?.label ?? "Select primary weapon"}
                                    </span>
                                    <ChevronDown
                                      className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                                        openDropdownKey ===
                                        `${run.runId}:primary`
                                          ? "rotate-180 text-amber-300"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                  {openDropdownKey ===
                                  `${run.runId}:primary` ? (
                                    <motion.div
                                      role="listbox"
                                      initial={{
                                        opacity: 0,
                                        y: -4,
                                        scale: 0.99
                                      }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -4, scale: 0.99 }}
                                      transition={{ duration: 0.16 }}
                                      className="absolute top-full right-0 z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                                    >
                                      {weapons.map((weapon) => (
                                        <button
                                          key={weapon.key}
                                          type="button"
                                          role="option"
                                          aria-selected={
                                            draftPrimaryWeaponKey === weapon.key
                                          }
                                          onClick={() => {
                                            setPrimaryWeaponDraftByRunId(
                                              (current) => ({
                                                ...current,
                                                [run.runId]: weapon.key
                                              })
                                            );
                                            setOpenDropdownKey(null);
                                          }}
                                          className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                            draftPrimaryWeaponKey === weapon.key
                                              ? "bg-amber-400/15 text-amber-100"
                                              : "text-gray-200 hover:bg-white/7"
                                          }`}
                                        >
                                          <Image
                                            src={`/weapons/${weapon.key}.png`}
                                            alt={weapon.key.toUpperCase()}
                                            title={weapon.key.toUpperCase()}
                                            width={20}
                                            height={20}
                                            className="h-5 w-5 object-contain"
                                          />
                                          {weapon.label}
                                        </button>
                                      ))}
                                    </motion.div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                  Secondary Weapon
                                </span>
                                <div className="relative">
                                  <button
                                    type="button"
                                    role="button"
                                    onClick={() =>
                                      setOpenDropdownKey((current) =>
                                        current === `${run.runId}:secondary`
                                          ? null
                                          : `${run.runId}:secondary`
                                      )
                                    }
                                    className="relative w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                                  >
                                    <span className="block truncate">
                                      {weapons.find(
                                        (weapon) =>
                                          weapon.key === draftSecondaryWeaponKey
                                      )?.label ?? "Select secondary weapon"}
                                    </span>
                                    <ChevronDown
                                      className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                                        openDropdownKey ===
                                        `${run.runId}:secondary`
                                          ? "rotate-180 text-amber-300"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                  {openDropdownKey ===
                                  `${run.runId}:secondary` ? (
                                    <motion.div
                                      role="listbox"
                                      initial={{
                                        opacity: 0,
                                        y: -4,
                                        scale: 0.99
                                      }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -4, scale: 0.99 }}
                                      transition={{ duration: 0.16 }}
                                      className="absolute top-full right-0 z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                                    >
                                      {weapons.map((weapon) => (
                                        <button
                                          key={weapon.key}
                                          type="button"
                                          role="option"
                                          aria-selected={
                                            draftSecondaryWeaponKey ===
                                            weapon.key
                                          }
                                          onClick={() => {
                                            setSecondaryWeaponDraftByRunId(
                                              (current) => ({
                                                ...current,
                                                [run.runId]: weapon.key
                                              })
                                            );
                                            setOpenDropdownKey(null);
                                          }}
                                          className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                            draftSecondaryWeaponKey ===
                                            weapon.key
                                              ? "bg-amber-400/15 text-amber-100"
                                              : "text-gray-200 hover:bg-white/7"
                                          }`}
                                        >
                                          <Image
                                            src={`/weapons/${weapon.key}.png`}
                                            alt={weapon.key.toUpperCase()}
                                            title={weapon.key.toUpperCase()}
                                            width={20}
                                            height={20}
                                            className="h-5 w-5 object-contain"
                                          />
                                          {weapon.label}
                                        </button>
                                      ))}
                                    </motion.div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="md:col-span-3">
                                <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                  Video
                                </div>
                                <input
                                  type="url"
                                  value={draftYoutubeLink}
                                  maxLength={MAX_SUBMIT_YOUTUBE_LINK_LENGTH}
                                  onChange={(event) =>
                                    setYoutubeLinkDraftByRunId((current) => ({
                                      ...current,
                                      [run.runId]: event.target.value
                                    }))
                                  }
                                  placeholder="https://www.youtube.com/watch?v=..."
                                  className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                                />
                              </div>

                              <div className="md:col-span-3">
                                <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                  Screenshot
                                </div>
                                {run.screenshotBase64 ? (
                                  <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/25">
                                    <Image
                                      src={run.screenshotBase64}
                                      alt="Run screenshot"
                                      width={1280}
                                      height={720}
                                      unoptimized
                                      className="h-auto w-full"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    -
                                  </span>
                                )}
                              </div>

                              <div className="md:col-span-3">
                                <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                  Tags
                                </div>

                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  {draftTags.length > 0 ? (
                                    draftTags.map((tag) => (
                                      <span
                                        key={`${run.runId}-${tag}`}
                                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gray-700 bg-white/5 px-2.5 text-xs text-gray-200"
                                      >
                                        <Tag className="h-3.5 w-3.5 text-gray-500" />
                                        {tag}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeTag(run.runId, tag)
                                          }
                                          className="ml-1 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:text-rose-300"
                                          aria-label="Remove tag"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-500">
                                      No tags
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={tagInputByRunId[run.runId] ?? ""}
                                    onChange={(event) =>
                                      setTagInputByRunId((current) => ({
                                        ...current,
                                        [run.runId]: event.target.value
                                      }))
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        addTag(run.runId);
                                      }
                                    }}
                                    placeholder="Add tag"
                                    className="w-full min-w-[180px] flex-1 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addTag(run.runId)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      savingRunId === run.runId ||
                                      !draftCategoryId ||
                                      !draftPrimaryWeaponKey ||
                                      !draftSecondaryWeaponKey ||
                                      !hasChanges
                                    }
                                    onClick={() => {
                                      if (
                                        !isValidYoutubeDraft(draftYoutubeLink)
                                      ) {
                                        setRunError(
                                          "YouTube link must point to a valid YouTube video"
                                        );
                                        return;
                                      }

                                      setRunError(null);
                                      setSavingRunId(run.runId);
                                      updateRunDetailsMutation.mutate({
                                        runId: run.runId,
                                        category: draftCategoryId,
                                        primaryWeaponKey: draftPrimaryWeaponKey,
                                        secondaryWeaponKey:
                                          draftSecondaryWeaponKey,
                                        youtubeLink:
                                          draftYoutubeLink.trim() || undefined,
                                        tags: draftTags
                                      });
                                    }}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {savingRunId === run.runId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                    Save
                                  </button>
                                  {hasChanges ? (
                                    <button
                                      type="button"
                                      onClick={() => resetDrafts(run)}
                                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      Reset
                                    </button>
                                  ) : null}
                                </div>

                                {existingTags.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {existingTags.slice(0, 18).map((tag) => (
                                      <button
                                        key={`${run.runId}-existing-${tag}`}
                                        type="button"
                                        onClick={() =>
                                          addTagValue(run.runId, tag)
                                        }
                                        className="rounded-full border border-gray-700 bg-white/5 px-2 py-1 text-xs whitespace-nowrap text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-300"
                                      >
                                        {tag}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </motion.tr>
                    ) : null}
                  </AnimatePresence>
                );
              })}
            </motion.tbody>
          )}
        </DataTable>

        {runError ? (
          <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {runError}
          </div>
        ) : null}

        {!pendingRunsQuery.isLoading && pendingRuns.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
            No pending runs.
          </div>
        ) : null}
      </AnimatedCard>

      <AnimatedCard className="relative z-10 p-6 shadow-2xl shadow-black/20">
        <DataTable
          title="Runs"
          description="Reviewed runs with full details."
          icon={<Clock3 className="h-6 w-6" />}
          iconColor="cyan"
          tableWrapperClassName="overflow-visible"
          columns={[
            { key: "status", label: "Status" },
            { key: "runner", label: "Runner" },
            { key: "quest", label: "Quest" },
            { key: "time", label: "Time" },
            { key: "submitted", label: "Submitted" },
            { key: "reviewer", label: "Reviewer" },
            { key: "actions", label: "Actions", className: "text-left" }
          ]}
        >
          {reviewedRunsQuery.isLoading ? (
            <DataTableLoadingState columnCount={7} label="Loading runs..." />
          ) : (
            <motion.tbody
              key="moderation-reviewed-runs-rows"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {reviewedRuns.map((run, index) => {
                const isExpanded = expandedReviewedRunId === run.runId;
                const submittedLabel = capitalizeFirst(
                  getRelativeTime(run.submittedAtMs)
                );
                const submittedDateTimeLabel = formatFullDateTime(
                  run.submittedAtMs
                );
                const reviewedAtMs =
                  run.status === "approved"
                    ? run.approvedAtMs
                    : run.rejectedAtMs;
                const reviewerSecondaryLabel = reviewedAtMs
                  ? formatFullDateTime(reviewedAtMs)
                  : "-";
                const isOwnRun = Boolean(
                  viewerUserId && viewerUserId === run.runnerUserId
                );
                const canModerateThisRun = isAdmin || !isOwnRun;
                const canRejectReviewed =
                  canModerateThisRun && run.status === "approved";
                const canApproveReviewed =
                  canModerateThisRun && run.status === "rejected";
                const canEditReviewedDetails = isAdmin;

                const draftTags = tagDraftByRunId[run.runId] ?? run.tagLabels;
                const draftCategoryId: ReviewedRunRow["categoryId"] =
                  categoryDraftByRunId[run.runId] ?? run.categoryId;
                const draftPrimaryWeaponKey =
                  primaryWeaponDraftByRunId[run.runId] ?? run.primaryWeaponKey;
                const draftSecondaryWeaponKey =
                  secondaryWeaponDraftByRunId[run.runId] ??
                  run.secondaryWeaponKey ??
                  run.primaryWeaponKey;
                const draftYoutubeLink =
                  youtubeLinkDraftByRunId[run.runId] ?? run.youtubeLink ?? "";

                const hasChanges = hasRunDraftChanges(
                  run,
                  draftTags,
                  draftCategoryId,
                  draftPrimaryWeaponKey,
                  draftSecondaryWeaponKey,
                  draftYoutubeLink
                );

                const category = getCategoryMeta(run.categoryId);
                const CategoryIcon = categoryIconMap[category.icon] ?? Flame;
                const tone =
                  categoryToneClasses[category.tone] ??
                  categoryToneClasses.amber;

                return (
                  <Fragment key={run.runId}>
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      className={`group cursor-pointer border-b border-gray-800/70 text-sm transition-colors ${
                        isExpanded ? "bg-white/6" : "hover:bg-white/5"
                      }`}
                      onClick={() => {
                        setExpandedReviewedRunId((current) =>
                          current === run.runId ? null : run.runId
                        );
                        ensureDrafts(run);
                      }}
                    >
                      <td className="px-3 py-4 align-middle">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(run.status)}`}
                        >
                          {run.status === "approved" ? "Approved" : "Rejected"}
                        </span>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="inline-flex items-center gap-3 text-gray-200">
                          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5">
                            {run.runnerAvatar ? (
                              <Image
                                src={run.runnerAvatar}
                                alt={run.runnerDisplayName}
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="inline-flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                                {run.runnerDisplayName
                                  .trim()
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">
                              {run.runnerDisplayName}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {run.hunterName}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="flex min-w-0 items-start gap-2">
                          <ChevronDown
                            className={`mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-amber-300" : ""
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {run.questTitle}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {run.difficultyStars}★ {run.monster} ·{" "}
                              {run.areaLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-left align-middle">
                        <div className="text-lg font-semibold text-white">
                          {formatRunTime(run.runTimeMs)}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="text-sm font-semibold text-white">
                          {submittedLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {submittedDateTimeLabel}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {run.reviewerDisplayName ?? "-"}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {reviewerSecondaryLabel}
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-3 py-4 text-left align-middle"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {canApproveReviewed ? (
                            <button
                              type="button"
                              disabled={processingRunId === run.runId}
                              onClick={() => {
                                setRunError(null);
                                setProcessingRunId(run.runId);
                                approveRunMutation.mutate({ runId: run.runId });
                              }}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-400/10 text-emerald-100 transition-colors hover:border-emerald-200 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Approve run"
                              title="Approve run"
                            >
                              {processingRunId === run.runId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}

                          {canRejectReviewed ? (
                            <button
                              type="button"
                              disabled={processingRunId === run.runId}
                              onClick={() => {
                                setRunError(null);
                                setProcessingRunId(run.runId);
                                rejectRunMutation.mutate({ runId: run.runId });
                              }}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-rose-300/30 bg-rose-400/10 text-rose-100 transition-colors hover:border-rose-200 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Reject run"
                              title="Reject run"
                            >
                              {processingRunId === run.runId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}

                          {isAdmin ? (
                            <button
                              type="button"
                              disabled={processingRunId === run.runId}
                              onClick={() => {
                                setRunError(null);
                                setProcessingRunId(run.runId);
                                deleteRunMutation.mutate({ runId: run.runId });
                              }}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-rose-300/30 bg-rose-400/10 text-rose-100 transition-colors hover:border-rose-200 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Delete run"
                              title="Delete run"
                            >
                              {processingRunId === run.runId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}

                          {!canApproveReviewed &&
                          !canRejectReviewed &&
                          !isAdmin ? (
                            <span className="text-xs text-gray-500">-</span>
                          ) : null}
                        </div>
                      </td>
                    </motion.tr>

                    <AnimatePresence initial={false}>
                      {isExpanded ? (
                        <motion.tr
                          key={`${run.runId}-reviewed-details`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-visible border-b border-gray-800/70"
                        >
                          <td
                            colSpan={7}
                            className="overflow-visible px-0 py-0 align-top"
                          >
                            <motion.div
                              initial={{
                                maxHeight: 0,
                                opacity: 0,
                                pointerEvents: "none"
                              }}
                              animate={{
                                maxHeight: 2000,
                                opacity: 1,
                                pointerEvents: "auto"
                              }}
                              exit={{
                                maxHeight: 0,
                                opacity: 0,
                                pointerEvents: "none"
                              }}
                              transition={{ duration: 0.24, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                              {canEditReviewedDetails ? (
                                <div className="grid gap-4 overflow-visible bg-gray-900 px-4 py-4 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                      Category
                                    </span>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        role="button"
                                        onClick={() =>
                                          setOpenDropdownKey((current) =>
                                            current ===
                                            `${run.runId}:reviewed:category`
                                              ? null
                                              : `${run.runId}:reviewed:category`
                                          )
                                        }
                                        className="relative w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                                      >
                                        <span className="block truncate">
                                          {
                                            getCategoryMeta(draftCategoryId)
                                              .label
                                          }
                                        </span>
                                        <ChevronDown
                                          className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                                            openDropdownKey ===
                                            `${run.runId}:reviewed:category`
                                              ? "rotate-180 text-amber-300"
                                              : ""
                                          }`}
                                        />
                                      </button>
                                      {openDropdownKey ===
                                      `${run.runId}:reviewed:category` ? (
                                        <motion.div
                                          role="listbox"
                                          initial={{
                                            opacity: 0,
                                            y: -4,
                                            scale: 0.99
                                          }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                            scale: 1
                                          }}
                                          exit={{
                                            opacity: 0,
                                            y: -4,
                                            scale: 0.99
                                          }}
                                          transition={{ duration: 0.16 }}
                                          className="absolute top-full right-0 z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                                        >
                                          {categoryOptions.map(
                                            (categoryOption) => (
                                              <button
                                                key={categoryOption.id}
                                                type="button"
                                                role="option"
                                                aria-selected={
                                                  draftCategoryId ===
                                                  categoryOption.id
                                                }
                                                onClick={() => {
                                                  setCategoryDraftByRunId(
                                                    (current) => ({
                                                      ...current,
                                                      [run.runId]:
                                                        categoryOption.id
                                                    })
                                                  );
                                                  setOpenDropdownKey(null);
                                                }}
                                                className={`flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                  draftCategoryId ===
                                                  categoryOption.id
                                                    ? "bg-amber-400/15 text-amber-100"
                                                    : "text-gray-200 hover:bg-white/7"
                                                }`}
                                              >
                                                {categoryOption.label}
                                              </button>
                                            )
                                          )}
                                        </motion.div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                      Primary Weapon
                                    </span>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        role="button"
                                        onClick={() =>
                                          setOpenDropdownKey((current) =>
                                            current ===
                                            `${run.runId}:reviewed:primary`
                                              ? null
                                              : `${run.runId}:reviewed:primary`
                                          )
                                        }
                                        className="relative w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                                      >
                                        <span className="block truncate">
                                          {weapons.find(
                                            (weapon) =>
                                              weapon.key ===
                                              draftPrimaryWeaponKey
                                          )?.label ?? "Select primary weapon"}
                                        </span>
                                        <ChevronDown
                                          className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                                            openDropdownKey ===
                                            `${run.runId}:reviewed:primary`
                                              ? "rotate-180 text-amber-300"
                                              : ""
                                          }`}
                                        />
                                      </button>
                                      {openDropdownKey ===
                                      `${run.runId}:reviewed:primary` ? (
                                        <motion.div
                                          role="listbox"
                                          initial={{
                                            opacity: 0,
                                            y: -4,
                                            scale: 0.99
                                          }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                            scale: 1
                                          }}
                                          exit={{
                                            opacity: 0,
                                            y: -4,
                                            scale: 0.99
                                          }}
                                          transition={{ duration: 0.16 }}
                                          className="absolute top-full right-0 z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                                        >
                                          {weapons.map((weapon) => (
                                            <button
                                              key={weapon.key}
                                              type="button"
                                              role="option"
                                              aria-selected={
                                                draftPrimaryWeaponKey ===
                                                weapon.key
                                              }
                                              onClick={() => {
                                                setPrimaryWeaponDraftByRunId(
                                                  (current) => ({
                                                    ...current,
                                                    [run.runId]: weapon.key
                                                  })
                                                );
                                                setOpenDropdownKey(null);
                                              }}
                                              className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                draftPrimaryWeaponKey ===
                                                weapon.key
                                                  ? "bg-amber-400/15 text-amber-100"
                                                  : "text-gray-200 hover:bg-white/7"
                                              }`}
                                            >
                                              <Image
                                                src={`/weapons/${weapon.key}.png`}
                                                alt={weapon.key.toUpperCase()}
                                                title={weapon.key.toUpperCase()}
                                                width={20}
                                                height={20}
                                                className="h-5 w-5 object-contain"
                                              />
                                              {weapon.label}
                                            </button>
                                          ))}
                                        </motion.div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                      Secondary Weapon
                                    </span>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        role="button"
                                        onClick={() =>
                                          setOpenDropdownKey((current) =>
                                            current ===
                                            `${run.runId}:reviewed:secondary`
                                              ? null
                                              : `${run.runId}:reviewed:secondary`
                                          )
                                        }
                                        className="relative w-full cursor-pointer rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                                      >
                                        <span className="block truncate">
                                          {weapons.find(
                                            (weapon) =>
                                              weapon.key ===
                                              draftSecondaryWeaponKey
                                          )?.label ?? "Select secondary weapon"}
                                        </span>
                                        <ChevronDown
                                          className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                                            openDropdownKey ===
                                            `${run.runId}:reviewed:secondary`
                                              ? "rotate-180 text-amber-300"
                                              : ""
                                          }`}
                                        />
                                      </button>
                                      {openDropdownKey ===
                                      `${run.runId}:reviewed:secondary` ? (
                                        <motion.div
                                          role="listbox"
                                          initial={{
                                            opacity: 0,
                                            y: -4,
                                            scale: 0.99
                                          }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                            scale: 1
                                          }}
                                          exit={{
                                            opacity: 0,
                                            y: -4,
                                            scale: 0.99
                                          }}
                                          transition={{ duration: 0.16 }}
                                          className="absolute top-full right-0 z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                                        >
                                          {weapons.map((weapon) => (
                                            <button
                                              key={weapon.key}
                                              type="button"
                                              role="option"
                                              aria-selected={
                                                draftSecondaryWeaponKey ===
                                                weapon.key
                                              }
                                              onClick={() => {
                                                setSecondaryWeaponDraftByRunId(
                                                  (current) => ({
                                                    ...current,
                                                    [run.runId]: weapon.key
                                                  })
                                                );
                                                setOpenDropdownKey(null);
                                              }}
                                              className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                draftSecondaryWeaponKey ===
                                                weapon.key
                                                  ? "bg-amber-400/15 text-amber-100"
                                                  : "text-gray-200 hover:bg-white/7"
                                              }`}
                                            >
                                              <Image
                                                src={`/weapons/${weapon.key}.png`}
                                                alt={weapon.key.toUpperCase()}
                                                title={weapon.key.toUpperCase()}
                                                width={20}
                                                height={20}
                                                className="h-5 w-5 object-contain"
                                              />
                                              {weapon.label}
                                            </button>
                                          ))}
                                        </motion.div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="md:col-span-3">
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Video
                                    </div>
                                    <input
                                      type="url"
                                      value={draftYoutubeLink}
                                      maxLength={MAX_SUBMIT_YOUTUBE_LINK_LENGTH}
                                      onChange={(event) =>
                                        setYoutubeLinkDraftByRunId(
                                          (current) => ({
                                            ...current,
                                            [run.runId]: event.target.value
                                          })
                                        )
                                      }
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Screenshot
                                    </div>
                                    {run.screenshotBase64 ? (
                                      <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/25">
                                        <Image
                                          src={run.screenshotBase64}
                                          alt="Run screenshot"
                                          width={1280}
                                          height={720}
                                          unoptimized
                                          className="h-auto w-full"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-500">
                                        -
                                      </span>
                                    )}
                                  </div>

                                  <div className="md:col-span-3">
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Tags
                                    </div>

                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                      {draftTags.length > 0 ? (
                                        draftTags.map((tag) => (
                                          <span
                                            key={`${run.runId}-${tag}`}
                                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gray-700 bg-white/5 px-2.5 text-xs text-gray-200"
                                          >
                                            <Tag className="h-3.5 w-3.5 text-gray-500" />
                                            {tag}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeTag(run.runId, tag)
                                              }
                                              className="ml-1 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:text-rose-300"
                                              aria-label="Remove tag"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-xs text-gray-500">
                                          No tags
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        value={tagInputByRunId[run.runId] ?? ""}
                                        onChange={(event) =>
                                          setTagInputByRunId((current) => ({
                                            ...current,
                                            [run.runId]: event.target.value
                                          }))
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            addTag(run.runId);
                                          }
                                        }}
                                        placeholder="Add tag"
                                        className="w-full min-w-[180px] flex-1 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => addTag(run.runId)}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500"
                                      >
                                        <Plus className="h-4 w-4" />
                                        Add
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          savingRunId === run.runId ||
                                          !draftCategoryId ||
                                          !draftPrimaryWeaponKey ||
                                          !draftSecondaryWeaponKey ||
                                          !hasChanges
                                        }
                                        onClick={() => {
                                          if (
                                            !isValidYoutubeDraft(
                                              draftYoutubeLink
                                            )
                                          ) {
                                            setRunError(
                                              "YouTube link must point to a valid YouTube video"
                                            );
                                            return;
                                          }

                                          setRunError(null);
                                          setSavingRunId(run.runId);
                                          updateReviewedRunDetailsMutation.mutate(
                                            {
                                              runId: run.runId,
                                              category: draftCategoryId,
                                              primaryWeaponKey:
                                                draftPrimaryWeaponKey,
                                              secondaryWeaponKey:
                                                draftSecondaryWeaponKey,
                                              youtubeLink:
                                                draftYoutubeLink.trim() ||
                                                undefined,
                                              tags: draftTags
                                            }
                                          );
                                        }}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingRunId === run.runId ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Save className="h-4 w-4" />
                                        )}
                                        Save
                                      </button>
                                      {hasChanges ? (
                                        <button
                                          type="button"
                                          onClick={() => resetDrafts(run)}
                                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500"
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                          Reset
                                        </button>
                                      ) : null}
                                    </div>

                                    {existingTags.length > 0 ? (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {existingTags
                                          .slice(0, 18)
                                          .map((tag) => (
                                            <button
                                              key={`${run.runId}-existing-${tag}`}
                                              type="button"
                                              onClick={() =>
                                                addTagValue(run.runId, tag)
                                              }
                                              className="rounded-full border border-gray-700 bg-white/5 px-2 py-1 text-xs whitespace-nowrap text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-300"
                                            >
                                              {tag}
                                            </button>
                                          ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="grid gap-4 overflow-visible bg-gray-900 px-4 py-4 md:grid-cols-3">
                                  <div>
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Hunter
                                    </div>
                                    <div className="text-sm font-semibold text-white">
                                      {run.hunterName}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Weapons
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Image
                                        src={`/weapons/${run.primaryWeaponKey}.png`}
                                        alt={run.primaryWeaponKey.toUpperCase()}
                                        title={run.primaryWeaponKey.toUpperCase()}
                                        width={28}
                                        height={28}
                                        className="h-7 w-7 object-contain"
                                      />
                                      {run.secondaryWeaponKey ? (
                                        <Image
                                          src={`/weapons/${run.secondaryWeaponKey}.png`}
                                          alt={run.secondaryWeaponKey.toUpperCase()}
                                          title={run.secondaryWeaponKey.toUpperCase()}
                                          width={28}
                                          height={28}
                                          className="h-7 w-7 object-contain"
                                        />
                                      ) : null}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Category
                                    </div>
                                    <CategoryTooltip
                                      label={category.label}
                                      description={category.description}
                                      link={category.link}
                                      wrapperClassName="inline-block"
                                    >
                                      <span
                                        className={`inline-flex h-6 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs leading-none ${tone.badge}`}
                                      >
                                        <CategoryIcon
                                          className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`}
                                        />
                                        {category.label}
                                      </span>
                                    </CategoryTooltip>
                                  </div>

                                  <div className="md:col-span-2">
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Tags
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-gray-300">
                                      {run.tagLabels.length > 0 ? (
                                        run.tagLabels.map((tagLabel) => (
                                          <span
                                            key={`${run.runId}-${tagLabel}`}
                                            className="inline-flex h-6 items-center justify-center gap-1.5 rounded-full border border-gray-700 bg-white/5 px-2.5 text-xs leading-none whitespace-nowrap text-gray-300 transition-all hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-amber-200 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_6px_18px_rgba(251,191,36,0.1)]"
                                          >
                                            <Tag className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                            {tagLabel}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-xs text-gray-500">
                                          -
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Video
                                    </div>
                                    {run.youtubeLink ? (
                                      <a
                                        href={run.youtubeLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-cyan-400/20"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Open YouTube Video
                                      </a>
                                    ) : (
                                      <span className="text-xs text-gray-500">
                                        -
                                      </span>
                                    )}
                                  </div>

                                  <div className="md:col-span-3">
                                    <div className="mb-1 text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                      Screenshot
                                    </div>
                                    {run.screenshotBase64 ? (
                                      <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/25">
                                        <Image
                                          src={run.screenshotBase64}
                                          alt="Run screenshot"
                                          width={1280}
                                          height={720}
                                          unoptimized
                                          className="h-auto w-full"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-500">
                                        -
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          </td>
                        </motion.tr>
                      ) : null}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </motion.tbody>
          )}
        </DataTable>

        {!reviewedRunsQuery.isLoading && reviewedRuns.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
            No reviewed runs yet.
          </div>
        ) : null}
      </AnimatedCard>
    </div>
  );
}
