"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  Clock3,
  Flame,
  Loader2,
  Upload,
  Plus,
  Send,
  Shield,
  Sword,
  Check,
  Tag,
  UserRound,
  X,
  Ban,
  Trash2,
  ImagePlus
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { type FileRejection, useDropzone } from "react-dropzone";

import { QUERY_DEFAULT_STALE_TIME_MS } from "~/constants";
import { extractYouTubeVideoId } from "~/lib/youtube";
import type {
  PlayerProfileRunRow,
  SubmitRunInput
} from "~/server/types/players";
import { type RunCategoryId } from "~/server/types/leaderboard";
import {
  MAX_SUBMIT_HUNTER_NAME_LENGTH,
  MAX_SUBMIT_SCREENSHOT_BYTES,
  MAX_SUBMIT_TAG_LENGTH,
  MAX_SUBMIT_TAGS,
  MAX_SUBMIT_YOUTUBE_LINK_LENGTH,
  submitRunInputSchema
} from "~/server/validation/players";
import { maskRunTimeInput } from "~/server/validation/run-time";
import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";
import CategoryTooltip from "./category-tooltip";
import DataTable, { getRelativeTime } from "./data-table";
import {
  capitalizeFirst,
  formatCountLabel,
  formatFullDateTime,
  formatRunTime
} from "./helpers";
import { categoryToneClasses, iconToneClasses } from "./theme-classes";
import PlacementBadges from "./placement-badges";

interface PlayerProfileViewProps {
  userId: string;
  onInitialReady?: () => void;
}

interface FormState {
  questId: string;
  hunterName: string;
  runTime: string;
  category: RunCategoryId;
  primaryWeaponKey: string;
  secondaryWeaponKey: string;
  youtubeLink: string;
  screenshotBase64: string;
  screenshotFileName: string;
  tags: string[];
}

const categoryIconMap = {
  flame: Flame,
  shield: Shield,
  "book-open": BookOpen,
  sword: Sword
} as const;

const defaultRunCategory = {
  label: "Unknown",
  icon: "flame" as const,
  tone: "cyan" as const,
  description: "",
  link: null
};

function emptyFormState(questId: string): FormState {
  return {
    questId,
    hunterName: "",
    runTime: "",
    category: "",
    primaryWeaponKey: "",
    secondaryWeaponKey: "",
    youtubeLink: "",
    screenshotBase64: "",
    screenshotFileName: "",
    tags: []
  };
}

const allowedScreenshotMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value === "string") {
        resolve(value);
      } else {
        reject(new Error("Failed to read screenshot file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read screenshot file."));
    reader.readAsDataURL(file);
  });
}

function statusBadge(status: "pending" | "approved" | "rejected") {
  if (status === "approved") {
    return "border-emerald-300/30 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border-rose-300/30 bg-rose-400/10 text-rose-300";
  }

  return "border-amber-300/30 bg-amber-400/10 text-amber-300";
}

function getStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const field: unknown = Reflect.get(value, key) as unknown;
  return typeof field === "string" ? field : null;
}

function getProfileRankBadgeClass(rank: number | null) {
  if (rank === 1) {
    return "border-amber-300/40 bg-amber-300/10 text-amber-300";
  }

  if (rank === 2) {
    return "border-gray-300/40 bg-gray-300/10 text-gray-200";
  }

  if (rank === 3) {
    return "border-orange-400/40 bg-orange-400/10 text-orange-300";
  }

  return "border-indigo-300/30 bg-indigo-400/10 text-indigo-200";
}

export default function PlayerProfileView({
  userId,
  onInitialReady
}: PlayerProfileViewProps) {
  const utils = api.useUtils();
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const profileQuery = api.players.profile.useQuery(
    { userId },
    {
      staleTime: QUERY_DEFAULT_STALE_TIME_MS
    }
  );

  const isCurrentUser = profileQuery.data?.isCurrentUser ?? false;
  const viewerRole = profileQuery.data?.viewerRole ?? null;
  const canModerateRuns = viewerRole === "moderator" || viewerRole === "admin";
  const isAdmin = viewerRole === "admin";
  const canModerateOwnRuns = isAdmin || !isCurrentUser;
  const canSeeSubmittedDate = canModerateRuns || isCurrentUser;
  const canSeeReviewerIdentity = canModerateRuns;
  const canSeeReviewColumn = canSeeReviewerIdentity || isCurrentUser;

  const submitOptionsQuery = api.players.submitOptions.useQuery(undefined, {
    staleTime: Infinity,
    enabled: isCurrentUser
  });
  const categoriesQuery = api.players.categories.useQuery(undefined, {
    staleTime: Infinity
  });

  const categoryById = useMemo(() => {
    return new Map(
      (categoriesQuery.data ?? []).map((category) => [
        category.id,
        {
          label: category.label,
          icon: category.icon,
          tone: category.color,
          description: category.description,
          link: category.link
        }
      ])
    );
  }, [categoriesQuery.data]);

  useEffect(() => {
    if (!onInitialReady) return;
    if (profileQuery.isLoading) return;
    if (isCurrentUser && submitOptionsQuery.isLoading) return;

    const timeout = window.setTimeout(() => onInitialReady(), 420);
    return () => window.clearTimeout(timeout);
  }, [
    isCurrentUser,
    onInitialReady,
    profileQuery.isLoading,
    submitOptionsQuery.isLoading
  ]);

  const defaultQuestId: string = useMemo(() => {
    const options = submitOptionsQuery.data;
    if (!options) return "";
    if (!options.quests[0]) return "";
    return options.quests[0].id;
  }, [submitOptionsQuery.data]);

  const [form, setForm] = useState<FormState>(() => emptyFormState(""));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdown &&
        !(event.target as HTMLElement).closest(
          '[role="button"], [role="listbox"]'
        )
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdown]);

  const formWithDefaultQuest =
    !form.questId && defaultQuestId
      ? { ...form, questId: defaultQuestId }
      : form;

  const selectedSubmitQuest = useMemo(() => {
    return (submitOptionsQuery.data?.quests ?? []).find(
      (quest) => quest.id === formWithDefaultQuest.questId
    );
  }, [formWithDefaultQuest.questId, submitOptionsQuery.data?.quests]);

  const isArenaQuest = selectedSubmitQuest?.type === "arena";

  const selectableCategories = useMemo(() => {
    const allCategories = submitOptionsQuery.data?.categories ?? [];
    return allCategories.filter((category) =>
      isArenaQuest ? category.id === "arena" : category.id !== "arena"
    );
  }, [isArenaQuest, submitOptionsQuery.data?.categories]);

  useEffect(() => {
    setForm((current) => {
      if (!current.questId) return current;

      if (isArenaQuest) {
        if (current.category === "arena") return current;
        return { ...current, category: "arena" };
      }

      if (current.category && current.category !== "arena") {
        return current;
      }

      const fallbackCategory = selectableCategories[0]?.id ?? "";
      return { ...current, category: fallbackCategory };
    });
  }, [isArenaQuest, selectableCategories]);

  const youtubeVideoId = useMemo(() => {
    const link = formWithDefaultQuest.youtubeLink.trim();
    if (!link) return null;
    return extractYouTubeVideoId(link);
  }, [formWithDefaultQuest.youtubeLink]);

  const youtubeLinkError = useMemo(() => {
    const link = formWithDefaultQuest.youtubeLink.trim();
    if (!link) return null;
    return youtubeVideoId ? null : "Please enter a valid YouTube video URL.";
  }, [formWithDefaultQuest.youtubeLink, youtubeVideoId]);

  const screenshotBase64 = formWithDefaultQuest.screenshotBase64.trim();

  const screenshotError = useMemo(() => {
    if (!screenshotBase64) return null;
    if (!screenshotBase64.startsWith("data:image/")) {
      return "Screenshot must be PNG, JPG, or WEBP.";
    }
    return null;
  }, [screenshotBase64]);

  const onDropScreenshot = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const rejectionCode = fileRejections[0]?.errors[0]?.code;

        if (rejectionCode === "file-too-large") {
          setFormError(
            `Screenshot must be at most ${(MAX_SUBMIT_SCREENSHOT_BYTES / 1_000_000).toFixed(1)} MB.`
          );
          return;
        }

        if (rejectionCode === "file-invalid-type") {
          setFormError("Screenshot must be PNG, JPG, or WEBP.");
          return;
        }

        setFormError("Screenshot upload failed. Please try another file.");
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      if (!allowedScreenshotMimeTypes.has(file.type)) {
        setFormError("Screenshot must be PNG, JPG, or WEBP.");
        return;
      }

      if (file.size > MAX_SUBMIT_SCREENSHOT_BYTES) {
        setFormError(
          `Screenshot must be at most ${(MAX_SUBMIT_SCREENSHOT_BYTES / 1_000_000).toFixed(1)} MB.`
        );
        return;
      }

      void (async () => {
        try {
          const dataUrl = await fileToDataUrl(file);
          setForm((current) => ({
            ...current,
            screenshotBase64: dataUrl,
            screenshotFileName: file.name
          }));
          setFormError(null);
        } catch {
          setFormError("Could not read screenshot file.");
        }
      })();
    },
    []
  );

  const submitMutation = api.players.submitRun.useMutation({
    onSuccess: async () => {
      setForm(emptyFormState(defaultQuestId));
      setTagInput("");
      setFormError(null);
      await Promise.all([
        utils.players.profile.invalidate({ userId }),
        utils.players.list.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.stats.getHomeStats.invalidate()
      ]);
    },
    onError: (error) => {
      setFormError(error.message || "Could not submit run.");
    }
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropScreenshot,
    multiple: false,
    disabled: submitMutation.isPending,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"]
    }
  });

  const deleteRunMutation = api.players.deleteRun.useMutation({
    onSuccess: async () => {
      setDeletingRunId(null);
      await Promise.all([
        utils.players.profile.invalidate({ userId }),
        utils.players.list.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.stats.getHomeStats.invalidate(),
        utils.players.submitOptions.invalidate()
      ]);
    },
    onError: () => {
      setDeletingRunId(null);
    }
  });

  const approveRunMutation = api.players.approveRun.useMutation({
    onSuccess: async () => {
      setDeletingRunId(null);
      await Promise.all([
        utils.players.profile.invalidate({ userId }),
        utils.players.list.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.stats.getHomeStats.invalidate()
      ]);
    },
    onError: () => {
      setDeletingRunId(null);
    }
  });

  const rejectRunMutation = api.players.rejectRun.useMutation({
    onSuccess: async () => {
      setDeletingRunId(null);
      await Promise.all([
        utils.players.profile.invalidate({ userId }),
        utils.players.list.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.stats.getHomeStats.invalidate(),
        utils.players.submitOptions.invalidate()
      ]);
    },
    onError: () => {
      setDeletingRunId(null);
    }
  });

  const addTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;

    if (tag.length > MAX_SUBMIT_TAG_LENGTH) {
      setFormError(`Tags can be at most ${MAX_SUBMIT_TAG_LENGTH} characters.`);
      return;
    }

    setForm((current) => {
      if (current.tags.includes(tag)) return current;
      if (current.tags.length >= MAX_SUBMIT_TAGS) {
        setFormError(`You can add at most ${MAX_SUBMIT_TAGS} tags.`);
        return current;
      }

      setFormError(null);
      return { ...current, tags: [...current.tags, tag] };
    });
  };

  const removeTag = (tag: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((existing) => existing !== tag)
    }));
  };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (youtubeLinkError) {
      setFormError(youtubeLinkError);
      return;
    }

    if (screenshotError) {
      setFormError(screenshotError);
      return;
    }

    if (isArenaQuest && formWithDefaultQuest.category !== "arena") {
      setFormError("Arena quests must use arena category.");
      return;
    }

    if (!isArenaQuest && formWithDefaultQuest.category === "arena") {
      setFormError("Arena category can only be used for arena quests.");
      return;
    }

    const payload: SubmitRunInput = {
      questId: formWithDefaultQuest.questId,
      hunterName: formWithDefaultQuest.hunterName,
      runTime: formWithDefaultQuest.runTime,
      category: formWithDefaultQuest.category || "fs",
      primaryWeaponKey: formWithDefaultQuest.primaryWeaponKey,
      secondaryWeaponKey: formWithDefaultQuest.secondaryWeaponKey,
      youtubeLink: formWithDefaultQuest.youtubeLink.trim() || undefined,
      screenshotBase64:
        formWithDefaultQuest.screenshotBase64.trim() || undefined,
      tags: formWithDefaultQuest.tags
    };

    const validated = submitRunInputSchema.safeParse(payload);
    if (!validated.success) {
      const firstIssue = validated.error.issues[0];
      setFormError(firstIssue?.message ?? "Invalid run submission.");
      return;
    }

    setFormError(null);
    submitMutation.mutate(validated.data);
  };

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="tm-card p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <motion.div
                className="h-14 w-14 rounded-full bg-gradient-to-r from-white/6 via-cyan-200/15 to-white/6"
                initial={{ opacity: 0.35, scale: 0.96 }}
                animate={{
                  opacity: [0.35, 0.85, 0.35],
                  scale: [0.96, 1, 0.96]
                }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <div className="space-y-3">
                <motion.div
                  className="h-8 w-44 rounded bg-white/10"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.8, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <motion.div
                  className="h-6 w-24 rounded-full bg-white/10"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.8, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.1
                  }}
                />
                <motion.div
                  className="h-4 w-32 rounded bg-white/8"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.72, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.2
                  }}
                />
              </div>
            </div>

            <div className="flex min-w-[150px] flex-col items-center gap-3 self-center md:self-auto">
              <motion.div
                className="h-10 w-20 rounded-md bg-gradient-to-r from-white/6 via-amber-200/15 to-white/6"
                initial={{ opacity: 0.35, scaleX: 0.94 }}
                animate={{
                  opacity: [0.35, 0.82, 0.35],
                  scaleX: [0.94, 1, 0.94]
                }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="h-3 w-16 rounded bg-white/10"
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.08
                }}
              />
              <div className="flex gap-2">
                <motion.div
                  className="h-6 w-6 rounded-full bg-white/10"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.1
                  }}
                />
                <motion.div
                  className="h-6 w-6 rounded-full bg-white/10"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.2
                  }}
                />
                <motion.div
                  className="h-6 w-6 rounded-full bg-white/10"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.3
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="tm-card p-6 shadow-2xl shadow-black/20">
          <div className="mb-6 flex items-start gap-3">
            <motion.div
              className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10"
              initial={{ opacity: 0.35, scale: 0.96 }}
              animate={{ opacity: [0.35, 0.82, 0.35], scale: [0.96, 1, 0.96] }}
              transition={{
                duration: 1.15,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <div className="space-y-3">
              <motion.div
                className="h-7 w-28 rounded bg-white/10"
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.35, 0.8, 0.35] }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="h-4 w-72 rounded bg-white/8"
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.35, 0.72, 0.35] }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.12
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-white/3 px-4 py-4"
                initial={{ opacity: 0.35, y: 4 }}
                animate={{ opacity: [0.35, 0.75, 0.35], y: [4, 0, 4] }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.12
                }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="h-10 w-10 rounded-full bg-white/10"
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: [0.35, 0.75, 0.35] }}
                    transition={{
                      duration: 1.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.08
                    }}
                  />
                  <div className="space-y-2">
                    <motion.div
                      className="h-4 w-40 rounded bg-white/10"
                      initial={{ opacity: 0.35 }}
                      animate={{ opacity: [0.35, 0.75, 0.35] }}
                      transition={{
                        duration: 1.15,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.08
                      }}
                    />
                    <motion.div
                      className="h-3 w-28 rounded bg-white/8"
                      initial={{ opacity: 0.35 }}
                      animate={{ opacity: [0.35, 0.72, 0.35] }}
                      transition={{
                        duration: 1.15,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.08 + 0.08
                      }}
                    />
                  </div>
                </div>

                <motion.div
                  className="h-6 w-20 rounded-full bg-white/10"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.08 + 0.04
                  }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  if (!profile?.user) {
    return (
      <AnimatedCard className="p-8 text-center">
        <p className="text-lg font-semibold text-white">Player not found</p>
        <p className="mt-2 text-sm text-gray-400">
          The selected profile does not exist.
        </p>
      </AnimatedCard>
    );
  }

  const allRuns: PlayerProfileRunRow[] = [...profile.runs].sort(
    (a, b) => b.submittedAtMs - a.submittedAtMs || b.runTimeMs - a.runTimeMs
  );
  const approvedRunsCount = allRuns.filter(
    (run) => run.status === "approved"
  ).length;

  const hasAnyRunActions = allRuns.some((run) => {
    const canDeleteRun = isAdmin || (isCurrentUser && run.status === "pending");
    const canApproveRun =
      canModerateRuns && canModerateOwnRuns && run.status !== "approved";
    const canRejectRun =
      canModerateRuns && canModerateOwnRuns && run.status !== "rejected";
    return canDeleteRun || canApproveRun || canRejectRun;
  });

  return (
    <div className="space-y-4">
      <AnimatedCard key="profile-header-card" className="p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5">
              {profile.user.avatar ? (
                <Image
                  src={profile.user.avatar}
                  alt={profile.user.displayName ?? "Player"}
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-6 w-6 text-gray-400" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-white">
                  {profile.user.displayName ??
                    profile.user.username ??
                    "Player"}
                </h1>
                <Link
                  href="/rankings"
                  className={`inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.12em] uppercase transition-colors hover:brightness-110 ${
                    profile.leaderboardPlacement
                      ? getProfileRankBadgeClass(profile.leaderboardPlacement)
                      : "border-gray-700 bg-white/5 text-gray-400"
                  }`}
                >
                  {profile.leaderboardPlacement
                    ? `Rank ${profile.leaderboardPlacement}`
                    : "Unranked"}
                </Link>
              </div>
              <p className="mt-2 text-sm text-gray-400">
                {formatCountLabel(approvedRunsCount, "total run")}
              </p>
            </div>
          </div>

          <div className="flex min-w-[150px] flex-col items-center gap-1.5 self-center md:self-auto">
            <div className="text-3xl leading-none font-bold text-amber-300 md:text-4xl">
              {Math.round(profile.performance.score).toLocaleString("en-US")}
            </div>
            <div className="mb-4 text-xs tracking-[0.14em] text-gray-500 uppercase">
              Score
            </div>
            <PlacementBadges
              first={profile.performance.top3Placements.first}
              second={profile.performance.top3Placements.second}
              third={profile.performance.top3Placements.third}
              className="justify-center"
            />
          </div>
        </div>
      </AnimatedCard>

      <AnimatedCard
        key="profile-runs-card"
        className="p-6 shadow-2xl shadow-black/20"
      >
        <DataTable
          title="Runs"
          description="All submitted runs by this player."
          icon={<Clock3 className="h-6 w-6" />}
          iconColor="cyan"
          columns={[
            { key: "status", label: "Status" },
            { key: "quest", label: "Quest" },
            { key: "time", label: "Time" },
            { key: "score", label: "Score" },
            {
              key: "date",
              label: canSeeSubmittedDate ? "Submitted" : "Approved"
            },
            ...(canSeeReviewColumn
              ? [
                  {
                    key: "reviewer",
                    label: canSeeReviewerIdentity ? "Reviewer" : "Review"
                  } as const
                ]
              : []),
            ...(hasAnyRunActions
              ? [{ key: "actions", label: "Actions" as const }]
              : [])
          ]}
        >
          <motion.tbody
            key="runs-rows"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {allRuns.map((run: PlayerProfileRunRow, index) => {
              const category =
                categoryById.get(run.categoryId) ?? defaultRunCategory;
              const CategoryIcon = categoryIconMap[category.icon] ?? Flame;
              const tone =
                categoryToneClasses[category.tone] ?? categoryToneClasses.amber;
              const isExpanded = expandedRunId === run.runId;
              const submittedAtDateTimeLabel = formatFullDateTime(
                run.submittedAtMs
              );
              const approvedAtDateTimeLabel = run.approvedAtMs
                ? formatFullDateTime(run.approvedAtMs)
                : null;
              const rejectedAtDateTimeLabel = run.rejectedAtMs
                ? formatFullDateTime(run.rejectedAtMs)
                : null;
              const approvedAtDisplayMs = run.approvedAtMs ?? run.submittedAtMs;
              const approvedRelativeLabel = capitalizeFirst(
                getRelativeTime(approvedAtDisplayMs)
              );
              const reviewedAtDateTimeLabel =
                run.status === "approved"
                  ? approvedAtDateTimeLabel
                  : run.status === "rejected"
                    ? rejectedAtDateTimeLabel
                    : null;
              const reviewedAtDisplayMs =
                run.status === "approved"
                  ? run.approvedAtMs
                  : run.status === "rejected"
                    ? run.rejectedAtMs
                    : null;
              const reviewerSubtitleLabel = reviewedAtDateTimeLabel;
              const submittedTitleLabel = canSeeSubmittedDate
                ? capitalizeFirst(getRelativeTime(run.submittedAtMs))
                : approvedRelativeLabel;
              const submittedSubtitleLabel = canSeeSubmittedDate
                ? submittedAtDateTimeLabel
                : (approvedAtDateTimeLabel ?? submittedAtDateTimeLabel);
              const reviewerTitleLabel: string | null = canSeeReviewerIdentity
                ? getStringField(run, "reviewerDisplayName")
                : isCurrentUser && reviewedAtDisplayMs
                  ? capitalizeFirst(getRelativeTime(reviewedAtDisplayMs))
                  : null;
              const reviewerSecondaryLabel = canSeeReviewerIdentity
                ? reviewerSubtitleLabel
                : isCurrentUser
                  ? reviewedAtDateTimeLabel
                  : null;
              const canDeleteRun =
                isAdmin || (isCurrentUser && run.status === "pending");
              const canApproveRun =
                canModerateRuns &&
                canModerateOwnRuns &&
                run.status !== "approved";
              const canRejectRun =
                canModerateRuns &&
                canModerateOwnRuns &&
                run.status !== "rejected";
              const runYoutubeLink = getStringField(run, "youtubeLink");
              const runYoutubeVideoId = runYoutubeLink
                ? extractYouTubeVideoId(runYoutubeLink)
                : null;
              const runScreenshotBase64 = getStringField(
                run,
                "screenshotBase64"
              );
              const hasMedia = Boolean(
                runYoutubeVideoId ?? runScreenshotBase64
              );
              const statusLabel =
                run.status === "approved"
                  ? "Approved"
                  : run.status === "rejected"
                    ? "Rejected"
                    : "Pending";
              const formattedScore = new Intl.NumberFormat("en-US").format(
                Number(run.score)
              );
              const scoreLabel =
                run.score !== null && run.score > 0 ? `+${formattedScore}` : "";
              const columnCount =
                5 + (canSeeReviewColumn ? 1 : 0) + (hasAnyRunActions ? 1 : 0);

              return (
                <Fragment key={run.runId}>
                  <motion.tr
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.025 }}
                    className={`group cursor-pointer border-b border-gray-800/70 text-sm transition-colors ${
                      isExpanded ? "bg-white/6" : "hover:bg-white/5"
                    }`}
                    onClick={() => {
                      setExpandedRunId((current) =>
                        current === run.runId ? null : run.runId
                      );
                    }}
                  >
                    <td className="px-3 py-4 align-middle">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(run.status)}`}
                      >
                        {statusLabel}
                      </span>
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
                    <td className="px-3 py-4 text-left align-middle">
                      <div>
                        <div className="text-lg font-semibold text-amber-300">
                          {scoreLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {run.rank !== null ? `Rank ${run.rank}` : "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className="inline-flex items-start gap-3 text-gray-200">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {submittedTitleLabel}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {submittedSubtitleLabel}
                          </div>
                        </div>
                      </div>
                    </td>
                    {canSeeReviewColumn ? (
                      <td className="px-3 py-4 align-middle">
                        {reviewerTitleLabel ? (
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {reviewerTitleLabel}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {reviewerSecondaryLabel ?? "-"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    ) : null}
                    {hasAnyRunActions ? (
                      <td
                        className="px-3 py-4 text-left align-middle"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {canApproveRun || canRejectRun || canDeleteRun ? (
                          <div className="flex w-fit items-center gap-2">
                            {canApproveRun ? (
                              <button
                                type="button"
                                disabled={deletingRunId === run.runId}
                                aria-label={
                                  deletingRunId === run.runId
                                    ? "Approving run"
                                    : "Approve run"
                                }
                                title={
                                  deletingRunId === run.runId
                                    ? "Approving run"
                                    : "Approve run"
                                }
                                onClick={() => {
                                  setDeletingRunId(run.runId);
                                  approveRunMutation.mutate({
                                    runId: run.runId
                                  });
                                }}
                                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 transition-colors hover:border-emerald-300 hover:bg-emerald-400/20 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingRunId === run.runId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}

                            {canRejectRun ? (
                              <button
                                type="button"
                                disabled={deletingRunId === run.runId}
                                aria-label={
                                  deletingRunId === run.runId
                                    ? "Rejecting run"
                                    : "Reject run"
                                }
                                title={
                                  deletingRunId === run.runId
                                    ? "Rejecting run"
                                    : "Reject run"
                                }
                                onClick={() => {
                                  setDeletingRunId(run.runId);
                                  rejectRunMutation.mutate({
                                    runId: run.runId
                                  });
                                }}
                                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-red-400/25 bg-red-400/10 text-red-200 transition-colors hover:border-red-300 hover:bg-red-400/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingRunId === run.runId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}

                            {canDeleteRun ? (
                              <button
                                type="button"
                                disabled={deletingRunId === run.runId}
                                aria-label={
                                  deletingRunId === run.runId
                                    ? "Deleting run"
                                    : "Delete run"
                                }
                                title={
                                  deletingRunId === run.runId
                                    ? "Deleting run"
                                    : "Delete run"
                                }
                                onClick={() => {
                                  setDeletingRunId(run.runId);
                                  deleteRunMutation.mutate({
                                    runId: run.runId
                                  });
                                }}
                                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-red-400/25 bg-red-400/10 text-red-200 transition-colors hover:border-red-300 hover:bg-red-400/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingRunId === run.runId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    ) : null}
                  </motion.tr>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.tr
                        key={`${run.runId}-details`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-b border-gray-800/70"
                      >
                        <td
                          colSpan={columnCount}
                          className="px-0 py-0 align-top"
                        >
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="grid gap-4 bg-gray-900 px-4 py-4 md:grid-cols-3">
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

                              <div className="md:col-span-3">
                                {hasMedia ? (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {runYoutubeVideoId ? (
                                      <div className="space-y-1">
                                        <div className="text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                          Video
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/35">
                                          <iframe
                                            className="aspect-video w-full"
                                            src={`https://www.youtube.com/embed/${runYoutubeVideoId}`}
                                            title="YouTube video"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            referrerPolicy="strict-origin-when-cross-origin"
                                            allowFullScreen
                                          />
                                        </div>
                                      </div>
                                    ) : null}

                                    {runScreenshotBase64 ? (
                                      <div className="space-y-1">
                                        <div className="text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                          Screenshot
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/25">
                                          <Image
                                            src={runScreenshotBase64}
                                            alt="Run screenshot"
                                            width={1280}
                                            height={720}
                                            unoptimized
                                            className="h-auto w-full"
                                          />
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    No video or screenshot
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </motion.tr>
                    ) : null}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </motion.tbody>
        </DataTable>

        {allRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
            {isCurrentUser
              ? "Submit your first run below."
              : "This player hasn't submitted any runs yet."}
          </div>
        ) : null}
      </AnimatedCard>

      {profile.isCurrentUser ? (
        <AnimatedCard key="profile-submit-run-card" className="p-6">
          <div className="mb-6 flex items-start gap-3">
            <div
              className={`flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full border ${iconToneClasses.emerald}`}
            >
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Submit New Run</h2>
              <p className="mt-1 text-sm text-gray-400">
                Submitted runs are reviewed before being shown on the
                leaderboard. Please add a screenshot or video to your run
                submission.
              </p>
            </div>
          </div>

          <form
            onSubmit={submitForm}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Quest
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === "quest" ? null : "quest")
                  }
                  className="relative w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                >
                  <span className="block truncate">
                    {(() => {
                      const quest = (
                        submitOptionsQuery.data?.quests ?? []
                      ).find((q) => q.id === formWithDefaultQuest.questId);
                      return quest
                        ? `${quest.title} · ${quest.difficultyStars}★ ${quest.monster}`
                        : "Select quest";
                    })()}
                  </span>
                  <ChevronDown
                    className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                      openDropdown === "quest"
                        ? "rotate-180 text-amber-300"
                        : ""
                    }`}
                  />
                </button>
                {openDropdown === "quest" && (
                  <motion.div
                    role="listbox"
                    initial={{ opacity: 0, y: -4, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.99 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                  >
                    {(submitOptionsQuery.data?.quests ?? []).map((quest) => {
                      return (
                        <button
                          key={quest.id}
                          type="button"
                          role="option"
                          aria-selected={
                            formWithDefaultQuest.questId === quest.id
                          }
                          onClick={() => {
                            setForm((current) => ({
                              ...current,
                              questId: quest.id
                            }));
                            setOpenDropdown(null);
                          }}
                          className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            formWithDefaultQuest.questId === quest.id
                              ? "bg-amber-400/15 text-amber-100"
                              : "text-gray-200 hover:bg-white/7"
                          }`}
                        >
                          {quest.title} · {quest.difficultyStars}★{" "}
                          {quest.monster}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </div>

            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Hunter Name
              </span>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.hunterName}
                maxLength={MAX_SUBMIT_HUNTER_NAME_LENGTH}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hunterName: event.target.value
                  }))
                }
                placeholder="Your in-game hunter name"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Run Time
              </span>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.runTime}
                onChange={(event) => {
                  const masked = maskRunTimeInput(event.target.value);
                  setForm((current) => ({
                    ...current,
                    runTime: masked
                  }));
                }}
                placeholder={"mm'ss\"cc"}
                maxLength={11}
                required
              />
            </label>

            <div className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Category
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    !isArenaQuest &&
                    setOpenDropdown(
                      openDropdown === "category" ? null : "category"
                    )
                  }
                  disabled={isArenaQuest}
                  className={`relative w-full rounded-lg border bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none ${
                    isArenaQuest
                      ? "cursor-not-allowed border-gray-800/90 opacity-70"
                      : "border-gray-700 hover:border-amber-400 focus-visible:border-amber-400"
                  }`}
                >
                  <span className="block truncate">
                    {selectableCategories.find(
                      (c) => c.id === formWithDefaultQuest.category
                    )?.label ?? "Select category"}
                  </span>
                  <ChevronDown
                    className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                      openDropdown === "category"
                        ? "rotate-180 text-amber-300"
                        : ""
                    }`}
                  />
                </button>
                {openDropdown === "category" && !isArenaQuest && (
                  <motion.div
                    role="listbox"
                    initial={{ opacity: 0, y: -4, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.99 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-30 mt-2 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                  >
                    {selectableCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        role="option"
                        aria-selected={
                          formWithDefaultQuest.category === category.id
                        }
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            category: category.id
                          }));
                          setOpenDropdown(null);
                        }}
                        className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          formWithDefaultQuest.category === category.id
                            ? "bg-amber-400/15 text-amber-100"
                            : "text-gray-200 hover:bg-white/7"
                        }`}
                      >
                        {category.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Primary Weapon
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "primary" ? null : "primary"
                    )
                  }
                  className="relative w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                >
                  <span className="block truncate">
                    {(submitOptionsQuery.data?.weapons ?? []).find(
                      (w) => w.key === formWithDefaultQuest.primaryWeaponKey
                    )?.label ?? "Select primary weapon"}
                  </span>
                  <ChevronDown
                    className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                      openDropdown === "primary"
                        ? "rotate-180 text-amber-300"
                        : ""
                    }`}
                  />
                </button>
                {openDropdown === "primary" && (
                  <motion.div
                    role="listbox"
                    initial={{ opacity: 0, y: -4, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.99 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                  >
                    {(submitOptionsQuery.data?.weapons ?? []).map((weapon) => (
                      <button
                        key={weapon.key}
                        type="button"
                        role="option"
                        aria-selected={
                          formWithDefaultQuest.primaryWeaponKey === weapon.key
                        }
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            primaryWeaponKey: weapon.key
                          }));
                          setOpenDropdown(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          formWithDefaultQuest.primaryWeaponKey === weapon.key
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
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Secondary Weapon
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "secondary" ? null : "secondary"
                    )
                  }
                  className="relative w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
                >
                  <span className="block truncate">
                    {(submitOptionsQuery.data?.weapons ?? []).find(
                      (w) => w.key === formWithDefaultQuest.secondaryWeaponKey
                    )?.label ?? "Select secondary weapon"}
                  </span>
                  <ChevronDown
                    className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                      openDropdown === "secondary"
                        ? "rotate-180 text-amber-300"
                        : ""
                    }`}
                  />
                </button>
                {openDropdown === "secondary" && (
                  <motion.div
                    role="listbox"
                    initial={{ opacity: 0, y: -4, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.99 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                  >
                    {(submitOptionsQuery.data?.weapons ?? []).map((weapon) => (
                      <button
                        key={weapon.key}
                        type="button"
                        role="option"
                        aria-selected={
                          formWithDefaultQuest.secondaryWeaponKey === weapon.key
                        }
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            secondaryWeaponKey: weapon.key
                          }));
                          setOpenDropdown(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          formWithDefaultQuest.secondaryWeaponKey === weapon.key
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
                )}
              </div>
            </div>

            <div className="space-y-4 md:col-span-2">
              <div className="space-y-1">
                <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                  YouTube Link (optional)
                </span>
                <input
                  type="url"
                  className={`w-full rounded-lg border bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none ${
                    youtubeLinkError
                      ? "border-red-400/70 focus:border-red-300"
                      : "border-gray-700 focus:border-amber-400"
                  }`}
                  value={formWithDefaultQuest.youtubeLink}
                  maxLength={MAX_SUBMIT_YOUTUBE_LINK_LENGTH}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      youtubeLink: event.target.value
                    }))
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {youtubeLinkError ? (
                  <p className="text-xs text-red-300">{youtubeLinkError}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                  Screenshot (optional)
                </span>
                {formWithDefaultQuest.screenshotBase64 ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">
                      <span className="truncate">
                        {formWithDefaultQuest.screenshotFileName ||
                          "Selected screenshot"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            screenshotBase64: "",
                            screenshotFileName: ""
                          }))
                        }
                        className="inline-flex cursor-pointer items-center rounded-full border border-amber-200/40 p-1 text-amber-100 transition-colors hover:border-red-300/60 hover:text-red-200"
                        aria-label="Remove screenshot"
                        title="Remove screenshot"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`cursor-pointer rounded-lg border border-dashed px-4 py-4 text-sm transition-colors ${
                      isDragActive
                        ? "border-amber-300 bg-amber-400/10"
                        : "border-gray-700 bg-gray-900/60 hover:border-amber-400/70"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex items-center gap-2 text-gray-200">
                      <ImagePlus className="h-4 w-4 text-amber-300" />
                      <span>
                        {isDragActive
                          ? "Drop screenshot here..."
                          : "Drag & drop screenshot, or click to select"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      PNG/JPG/WEBP, max{" "}
                      {(MAX_SUBMIT_SCREENSHOT_BYTES / 1_000_000).toFixed(1)} MB
                    </p>
                  </div>
                )}

                {screenshotError ? (
                  <p className="text-xs text-red-300">{screenshotError}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {formWithDefaultQuest.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs whitespace-nowrap text-amber-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="cursor-pointer text-amber-300 transition-colors hover:text-amber-200"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    maxLength={MAX_SUBMIT_TAG_LENGTH}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addTag(tagInput);
                      setTagInput("");
                    }}
                    placeholder="Add tag"
                    className="min-w-[12rem] flex-1 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTag(tagInput);
                      setTagInput("");
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-amber-400 hover:text-amber-300"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {(submitOptionsQuery.data?.existingTags.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {submitOptionsQuery.data?.existingTags
                    .slice(0, 18)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="rounded-full border border-gray-700 bg-white/5 px-2 py-1 text-xs whitespace-nowrap text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-300"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>

            {formError ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-200 md:col-span-2">
                <AlertCircle className="h-4 w-4" />
                {formError}
              </div>
            ) : null}

            <div className="flex justify-end md:col-span-2">
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 font-semibold text-gray-900 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {submitMutation.isPending ? "Submitting..." : "Submit run"}
              </button>
            </div>

            {youtubeVideoId ? (
              <div className="md:col-span-2">
                <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/35">
                  <iframe
                    className="aspect-video w-full"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                    title="YouTube video preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
          </form>
        </AnimatedCard>
      ) : null}
    </div>
  );
}
