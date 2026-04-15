"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Plus, Send, UserRound, X } from "lucide-react";

import type { SubmitRunInput } from "~/server/types/players";
import { type RunCategoryId } from "~/server/types/leaderboard";
import { submitRunInputSchema } from "~/server/validation/players";
import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";
import { categoryBadgeClasses } from "./theme-classes";
import PlacementBadges from "./placement-badges";

interface PlayerProfileViewProps {
  userId: string;
  onInitialReady?: () => void;
}

interface FormState {
  questId: string;
  hunterName: string;
  runTime: string;
  category: RunCategoryId | "";
  primaryWeaponKey: string;
  secondaryWeaponKey: string;
  tags: string[];
}

function emptyFormState(questId: string): FormState {
  return {
    questId,
    hunterName: "",
    runTime: "",
    category: "",
    primaryWeaponKey: "",
    secondaryWeaponKey: "",
    tags: [],
  };
}

function statusBadge(isApproved: boolean) {
  if (isApproved) {
    return "border-emerald-300/30 bg-emerald-400/10 text-emerald-300";
  }

  return "border-amber-300/30 bg-amber-400/10 text-amber-300";
}

export default function PlayerProfileView({
  userId,
  onInitialReady,
}: PlayerProfileViewProps) {
  const utils = api.useUtils();
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const profileQuery = api.players.profile.useQuery(
    { userId },
    {
      staleTime: 30_000,
    },
  );

  const isCurrentUser = profileQuery.data?.isCurrentUser ?? false;

  const submitOptionsQuery = api.players.submitOptions.useQuery(undefined, {
    staleTime: Infinity,
    enabled: isCurrentUser,
  });

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
    submitOptionsQuery.isLoading,
  ]);

  const defaultQuestId: string = useMemo(() => {
    const options = submitOptionsQuery.data;
    if (!options) return "";
    if (!options.quests[0]) return "";
    return options.questIdsBySlug[options.quests[0].slug] ?? "";
  }, [submitOptionsQuery.data]);

  const [form, setForm] = useState<FormState>(() => emptyFormState(""));

  const formWithDefaultQuest =
    !form.questId && defaultQuestId
      ? { ...form, questId: defaultQuestId }
      : form;

  const submitMutation = api.players.submitRun.useMutation({
    onSuccess: async () => {
      setForm(emptyFormState(defaultQuestId));
      setTagInput("");
      setFormError(null);
      await Promise.all([
        utils.players.profile.invalidate({ userId }),
        utils.players.list.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.stats.getHomeStats.invalidate(),
      ]);
    },
    onError: (error) => {
      setFormError(error.message || "Could not submit run.");
    },
  });

  const addTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;
    setForm((current) => {
      if (current.tags.includes(tag)) return current;
      if (current.tags.length >= 10) return current;
      return { ...current, tags: [...current.tags, tag] };
    });
  };

  const removeTag = (tag: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((existing) => existing !== tag),
    }));
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: SubmitRunInput = {
      questId: formWithDefaultQuest.questId,
      hunterName: formWithDefaultQuest.hunterName,
      runTime: formWithDefaultQuest.runTime,
      category: formWithDefaultQuest.category || "fs",
      primaryWeaponKey: formWithDefaultQuest.primaryWeaponKey,
      secondaryWeaponKey: formWithDefaultQuest.secondaryWeaponKey,
      tags: formWithDefaultQuest.tags,
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
      <AnimatedCard className="p-6">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-72 animate-pulse rounded bg-white/10" />
          <div className="h-56 animate-pulse rounded bg-white/5" />
        </div>
      </AnimatedCard>
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

  const allRuns = [...profile.pendingRuns, ...profile.approvedRuns].sort(
    (a, b) => b.submittedAtMs - a.submittedAtMs || b.runTimeMs - a.runTimeMs,
  );

  return (
    <div className="space-y-4">
      <AnimatedCard className="p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5">
              {profile.user.avatar ? (
                <img
                  src={profile.user.avatar}
                  alt={profile.user.displayName ?? "Player"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-6 w-6 text-gray-400" />
              )}
            </span>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {profile.user.displayName ?? profile.user.username ?? "Player"}
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                {allRuns.length} total runs
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

      {profile.isCurrentUser ? (
        <AnimatedCard className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Submit New Run</h2>
            <p className="mt-1 text-sm text-gray-400">
              Pending runs are reviewed before being shown in the public
              leaderboard.
            </p>
          </div>

          <form
            onSubmit={submitForm}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Quest
              </span>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.questId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    questId: event.target.value,
                  }))
                }
                required
              >
                {(submitOptionsQuery.data?.quests ?? []).map((quest) => {
                  const id =
                    submitOptionsQuery.data?.questIdsBySlug[quest.slug] ?? "";
                  return (
                    <option key={quest.slug} value={id}>
                      {quest.title} · {quest.difficultyStars}★ {quest.monster}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Hunter Name
              </span>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.hunterName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hunterName: event.target.value,
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    runTime: event.target.value,
                  }))
                }
                placeholder="mm:ss.cc"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Category
              </span>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as RunCategoryId,
                  }))
                }
                required
              >
                <option value="">Select category</option>
                {(submitOptionsQuery.data?.categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Primary Weapon
              </span>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.primaryWeaponKey}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryWeaponKey: event.target.value,
                  }))
                }
                required
              >
                <option value="">Select primary weapon</option>
                {(submitOptionsQuery.data?.weapons ?? []).map((weapon) => (
                  <option key={weapon.key} value={weapon.key}>
                    {weapon.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Secondary Weapon (optional)
              </span>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
                value={formWithDefaultQuest.secondaryWeaponKey}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    secondaryWeaponKey: event.target.value,
                  }))
                }
              >
                <option value="">No secondary weapon</option>
                {(submitOptionsQuery.data?.weapons ?? []).map((weapon) => (
                  <option key={weapon.key} value={weapon.key}>
                    {weapon.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2 md:col-span-2">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Tags
              </span>
              <div className="flex flex-wrap gap-2">
                {formWithDefaultQuest.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-200"
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

              {(submitOptionsQuery.data?.existingTags.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {submitOptionsQuery.data?.existingTags
                    .slice(0, 18)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="rounded-full border border-gray-700 bg-white/5 px-2 py-1 text-xs text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-300"
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
          </form>
        </AnimatedCard>
      ) : null}

      {profile.pendingRuns.length > 0 ? (
        <AnimatedCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-amber-300" />
            <h2 className="text-lg font-semibold text-white">Pending Runs</h2>
          </div>
          <div className="space-y-2">
            {profile.pendingRuns.map((run) => (
              <div
                key={run.runId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/20 bg-amber-400/5 px-3 py-2 text-sm"
              >
                <div className="text-gray-200">
                  <span className="font-medium">{run.questTitle}</span>
                  <span className="text-gray-400"> · {run.hunterName}</span>
                </div>
                <div className="inline-flex items-center gap-2 text-gray-300">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${statusBadge(false)}`}
                  >
                    Pending
                  </span>
                  <span>{run.runTimeLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </AnimatedCard>
      ) : null}

      <AnimatedCard className="p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Runs</h2>
          <p className="mt-1 text-sm text-gray-400">
            Newest entries are shown first.
          </p>
        </div>

        <div className="no-scrollbar overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs tracking-[0.2em] text-gray-500 uppercase">
                <th className="border-b border-gray-800 px-3 py-3">Date</th>
                <th className="border-b border-gray-800 px-3 py-3">Quest</th>
                <th className="border-b border-gray-800 px-3 py-3">Hunter</th>
                <th className="border-b border-gray-800 px-3 py-3">Weapons</th>
                <th className="border-b border-gray-800 px-3 py-3">Category</th>
                <th className="border-b border-gray-800 px-3 py-3">Tags</th>
                <th className="border-b border-gray-800 px-3 py-3">Status</th>
                <th className="border-b border-gray-800 px-3 py-3 text-right">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {allRuns.map((run) => {
                const categoryColorClass =
                  categoryBadgeClasses[
                    run.categoryColor as keyof typeof categoryBadgeClasses
                  ] ?? categoryBadgeClasses.amber;

                return (
                  <tr
                    key={run.runId}
                    className="border-b border-gray-800/70 text-sm transition-colors hover:bg-white/4"
                  >
                    <td className="px-3 py-3 text-gray-300">
                      {run.submittedAtLabel}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-gray-100">{run.questTitle}</div>
                      <div className="text-xs text-gray-500">
                        {run.difficultyStars}★ {run.monster} · {run.areaLabel}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-300">
                      {run.hunterName}
                    </td>
                    <td className="px-3 py-3 text-gray-300">
                      {run.secondaryWeaponLabel
                        ? `${run.primaryWeaponLabel} / ${run.secondaryWeaponLabel}`
                        : run.primaryWeaponLabel}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs ${categoryColorClass}`}
                      >
                        {run.categoryLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-300">
                      {run.tagLabels.length > 0
                        ? run.tagLabels.join(", ")
                        : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(run.isApproved)}`}
                      >
                        {run.isApproved ? "Approved" : "Pending"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-base text-amber-100">
                      {run.runTimeLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {allRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
            {isCurrentUser
              ? "Submit your first run!"
              : "This player hasn't submitted any runs yet."}
          </div>
        ) : null}
      </AnimatedCard>
    </div>
  );
}
