"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ListTodo,
  Pencil,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-react";

import { api } from "~/trpc/react";
import type {
  QuestManagementRow,
  QuestFormOptions
} from "~/server/types/quests";
import type { QuestType } from "~/server/types/leaderboard";
import { questCreateInputSchema } from "~/server/validation/quests";
import AnimatedCard from "./animated-card";
import DataTable, { DataTableLoadingState } from "./data-table";
import { capitalizeFirst } from "./helpers";
import { iconToneClasses } from "./theme-classes";

interface QuestsTableProps {
  delay?: number;
  onInitialReady?: () => void;
}

interface QuestFormState {
  title: string;
  monster: string;
  type: QuestType | "";
  areaKey: string;
  difficultyStars: string;
}

const emptyQuestForm: QuestFormState = {
  title: "",
  monster: "",
  type: "",
  areaKey: "",
  difficultyStars: ""
};

export default function QuestsTable({
  delay = 0,
  onInitialReady
}: QuestsTableProps) {
  const utils = api.useUtils();
  const questsQuery = api.quests.list.useQuery(undefined, {
    staleTime: 15_000
  });
  const formOptionsQuery = api.quests.formOptions.useQuery(undefined, {
    staleTime: Infinity
  });

  const [form, setForm] = useState<QuestFormState>(emptyQuestForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const areaDropdownRef = useRef<HTMLDivElement>(null);

  const quests: QuestManagementRow[] = questsQuery.data ?? [];
  const formOptions: QuestFormOptions | undefined = formOptionsQuery.data;

  useEffect(() => {
    if (!onInitialReady) return;
    if (questsQuery.isLoading || formOptionsQuery.isLoading) return;

    const rowCount = quests.length;
    const totalDelayMs = Math.min(900, 320 + rowCount * 20);
    const timeout = window.setTimeout(() => onInitialReady(), totalDelayMs);

    return () => window.clearTimeout(timeout);
  }, [
    formOptionsQuery.isLoading,
    onInitialReady,
    quests.length,
    questsQuery.isLoading
  ]);

  useEffect(() => {
    const defaultArea = formOptions?.areas[0]?.key ?? "";
    const defaultType = formOptions?.questTypes[0]?.key ?? "";

    setForm((current) => ({
      ...current,
      areaKey: current.areaKey || defaultArea,
      type: current.type || defaultType
    }));
  }, [formOptions]);

  useEffect(() => {
    if (!isTypeDropdownOpen && !isAreaDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (typeDropdownRef.current?.contains(event.target as Node)) return;
      if (areaDropdownRef.current?.contains(event.target as Node)) return;
      if (!areaDropdownRef.current) return;
      if (!areaDropdownRef.current.contains(event.target as Node)) {
        setIsAreaDropdownOpen(false);
      }
      if (!typeDropdownRef.current?.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isAreaDropdownOpen, isTypeDropdownOpen]);

  const createQuestMutation = api.quests.create.useMutation({
    onSuccess: async () => {
      setForm((current) => ({
        ...emptyQuestForm,
        areaKey: current.areaKey
      }));
      setFormError(null);
      await Promise.all([
        utils.quests.list.invalidate(),
        utils.leaderboard.filters.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.players.submitOptions.invalidate(),
        utils.players.profile.invalidate()
      ]);
    },
    onError: (error: unknown) => {
      setFormError(
        error instanceof Error ? error.message : "Could not create quest."
      );
    }
  });

  const updateQuestMutation = api.quests.update.useMutation({
    onSuccess: async () => {
      setEditingQuestId(null);
      setForm((current) => ({
        ...emptyQuestForm,
        areaKey: current.areaKey
      }));
      setFormError(null);
      await Promise.all([
        utils.quests.list.invalidate(),
        utils.leaderboard.filters.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.players.submitOptions.invalidate(),
        utils.players.profile.invalidate()
      ]);
    },
    onError: (error: unknown) => {
      setFormError(
        error instanceof Error ? error.message : "Could not update quest."
      );
    }
  });

  const deleteQuestMutation = api.quests.delete.useMutation({
    onSuccess: async () => {
      setFormError(null);
      if (editingQuestId) {
        setEditingQuestId(null);
      }
      await Promise.all([
        utils.quests.list.invalidate(),
        utils.leaderboard.filters.invalidate(),
        utils.leaderboard.getLeaderboard.invalidate(),
        utils.players.submitOptions.invalidate(),
        utils.players.profile.invalidate()
      ]);
    },
    onError: (error: unknown) => {
      setFormError(
        error instanceof Error ? error.message : "Could not delete quest."
      );
    }
  });

  const isSaving =
    createQuestMutation.isPending || updateQuestMutation.isPending;

  const isDeleting = deleteQuestMutation.isPending;

  const submitQuest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      title: form.title,
      monster: form.monster,
      type: (form.type || formOptions?.questTypes[0]?.key) ?? "event",
      areaKey: form.areaKey || "plains",
      difficultyStars: Number(form.difficultyStars)
    };

    const parsed = questCreateInputSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid quest input.");
      return;
    }

    setFormError(null);

    if (editingQuestId) {
      updateQuestMutation.mutate({
        questId: editingQuestId,
        ...parsed.data
      });
      return;
    }

    createQuestMutation.mutate(parsed.data);
  };

  return (
    <div className="space-y-4">
      <AnimatedCard delay={delay} className="relative z-20 p-6">
        <div className="mb-6 flex items-start gap-3">
          <div
            className={`flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full border ${iconToneClasses.emerald}`}
          >
            <Plus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              {editingQuestId ? "Edit Quest" : "Add Quest"}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Create and maintain quests directly in the database.
            </p>
          </div>
        </div>

        <form
          onSubmit={submitQuest}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Title
            </span>
            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
              placeholder="Jin Dahaad Event Quest"
              required
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Type
            </span>
            <div className="relative" ref={typeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTypeDropdownOpen((current) => !current)}
                className="relative w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
              >
                <span className="block truncate">
                  {(formOptions?.questTypes ?? []).find(
                    (questType) => questType.key === form.type
                  )?.label ?? "Select type"}
                </span>
                <ChevronDown
                  className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                    isTypeDropdownOpen ? "rotate-180 text-amber-300" : ""
                  }`}
                />
              </button>

              {isTypeDropdownOpen ? (
                <motion.div
                  role="listbox"
                  initial={{ opacity: 0, y: -4, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                  transition={{ duration: 0.16 }}
                  className="absolute z-30 mt-2 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                >
                  {(formOptions?.questTypes ?? []).map((questType) => (
                    <button
                      key={questType.key}
                      type="button"
                      role="option"
                      aria-selected={form.type === questType.key}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          type: questType.key
                        }));
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        form.type === questType.key
                          ? "bg-amber-400/15 text-amber-100"
                          : "text-gray-200 hover:bg-white/7"
                      }`}
                    >
                      {questType.label}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Area
            </span>
            <div className="relative" ref={areaDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAreaDropdownOpen((current) => !current)}
                className="relative w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-10 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
              >
                <span className="block truncate">
                  {(formOptions?.areas ?? []).find(
                    (area) => area.key === form.areaKey
                  )?.label ?? "Select area"}
                </span>
                <ChevronDown
                  className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                    isAreaDropdownOpen ? "rotate-180 text-amber-300" : ""
                  }`}
                />
              </button>

              {isAreaDropdownOpen ? (
                <motion.div
                  role="listbox"
                  initial={{ opacity: 0, y: -4, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                  transition={{ duration: 0.16 }}
                  className="absolute z-30 mt-2 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                >
                  {(formOptions?.areas ?? []).map((area) => (
                    <button
                      key={area.key}
                      type="button"
                      role="option"
                      aria-selected={form.areaKey === area.key}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          areaKey: area.key
                        }));
                        setIsAreaDropdownOpen(false);
                      }}
                      className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        form.areaKey === area.key
                          ? "bg-amber-400/15 text-amber-100"
                          : "text-gray-200 hover:bg-white/7"
                      }`}
                    >
                      {area.label}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </div>
          </div>

          <label className="space-y-1">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Difficulty Stars
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={form.difficultyStars}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  difficultyStars: event.target.value
                }))
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
              placeholder="8"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Monster
            </span>
            <input
              type="text"
              value={form.monster}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  monster: event.target.value
                }))
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 transition-colors outline-none focus:border-amber-400"
              placeholder="Jin Dahaad"
              required
            />
          </label>

          {formError ? (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200 md:col-span-2">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-200 hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingQuestId ? (
                <Save className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isSaving
                ? "Saving..."
                : editingQuestId
                  ? "Save Changes"
                  : "Create Quest"}
            </button>

            {editingQuestId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingQuestId(null);
                  setForm((current) => ({
                    ...emptyQuestForm,
                    areaKey: current.areaKey
                  }));
                  setFormError(null);
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500"
              >
                <X className="h-4 w-4" />
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </AnimatedCard>

      <AnimatedCard
        delay={delay + 0.1}
        className="relative z-10 p-6 shadow-2xl shadow-black/20"
      >
        <DataTable
          title="Quests"
          description="All quests currently available in the system"
          icon={<ListTodo className="h-6 w-6" />}
          iconColor="cyan"
          columns={[
            { key: "stars", label: "Difficulty", className: "text-center" },
            { key: "title", label: "Title" },
            { key: "monster", label: "Monster" },
            { key: "type", label: "Type" },
            { key: "area", label: "Area" },
            { key: "actions", label: "Actions", className: "text-left" }
          ]}
        >
          {questsQuery.isLoading ? (
            <DataTableLoadingState columnCount={6} label="Loading quests..." />
          ) : (
            <motion.tbody
              key="quest-rows"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {quests.map((quest, index) => (
                <motion.tr
                  key={quest.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="border-b border-gray-800/70 text-sm transition-colors hover:bg-white/5"
                >
                  <td className="px-3 py-4 text-center align-middle">
                    <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                      {quest.difficultyStars}★
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {quest.title}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 align-middle text-gray-300">
                    {quest.monster}
                  </td>
                  <td className="px-3 py-4 align-middle text-gray-300">
                    {capitalizeFirst(quest.type)}
                  </td>
                  <td className="px-3 py-4 align-middle text-gray-300">
                    {quest.areaLabel}
                  </td>
                  <td className="px-3 py-4 text-left align-middle">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestId(quest.id);
                          setForm({
                            title: quest.title,
                            monster: quest.monster,
                            type: quest.type,
                            areaKey: quest.areaKey,
                            difficultyStars: String(quest.difficultyStars)
                          });
                          setFormError(null);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        aria-label="Edit quest"
                        title="Edit quest"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-cyan-400/20"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => {
                          setFormError(null);
                          deleteQuestMutation.mutate({ questId: quest.id });
                        }}
                        aria-label="Delete quest"
                        title="Delete quest"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-300/30 bg-red-400/10 text-red-100 transition-colors hover:border-red-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          )}
        </DataTable>

        {!questsQuery.isLoading && quests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
            No quests found.
          </div>
        ) : null}
      </AnimatedCard>
    </div>
  );
}
