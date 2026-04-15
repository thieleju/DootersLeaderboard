"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Filter,
  Flame,
  Layers,
  Shield,
  Tag,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import type {
  LeaderboardCategoryFilterKey,
  LeaderboardCategoryOption,
  LeaderboardQuestOption,
  LeaderboardRow,
} from "~/server/types/leaderboard";
import AnimatedCard from "./animated-card";

const categoryIconMap = {
  flame: Flame,
  shield: Shield,
  "book-open": BookOpen,
} as const;

const categoryColorClasses = {
  amber: {
    active:
      "border-amber-300 bg-amber-400 text-gray-950 shadow-lg shadow-amber-400/20",
    inactive:
      "border-amber-300/25 bg-amber-400/10 text-amber-100 hover:border-amber-300 hover:bg-amber-400/20",
    badge: "border-amber-300/30 bg-amber-400/10 text-amber-200",
    icon: "text-amber-300",
  },
  cyan: {
    active:
      "border-cyan-300 bg-cyan-400 text-cyan-950 shadow-lg shadow-cyan-400/20",
    inactive:
      "border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-400/20",
    badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
    icon: "text-cyan-300",
  },
  emerald: {
    active:
      "border-emerald-300 bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-400/20",
    inactive:
      "border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-400/20",
    badge: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    icon: "text-emerald-300",
  },
  violet: {
    active:
      "border-violet-300 bg-violet-400 text-violet-950 shadow-lg shadow-violet-400/20",
    inactive:
      "border-violet-300/25 bg-violet-400/10 text-violet-100 hover:border-violet-300 hover:bg-violet-400/20",
    badge: "border-violet-300/30 bg-violet-400/10 text-violet-200",
    icon: "text-violet-300",
  },
} as const;

interface LeaderboardTableProps {
  delay?: number;
}

export default function LeaderboardTable({ delay = 0 }: LeaderboardTableProps) {
  const router = useRouter();
  const questSelectRef = useRef<HTMLDivElement | null>(null);
  const filtersQuery = api.leaderboard.filters.useQuery(undefined, {
    staleTime: Infinity,
  });
  const [questSlug, setQuestSlug] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<LeaderboardCategoryFilterKey>("all");
  const [isQuestMenuOpen, setIsQuestMenuOpen] = useState(false);

  useEffect(() => {
    if (!questSlug && filtersQuery.data?.defaultQuestSlug) {
      setQuestSlug(filtersQuery.data.defaultQuestSlug);
    }
  }, [filtersQuery.data?.defaultQuestSlug, questSlug]);

  const leaderboardQuery = api.leaderboard.getLeaderboard.useQuery(undefined, {
    staleTime: Infinity,
  });

  const questOptions: LeaderboardQuestOption[] =
    filtersQuery.data?.quests ?? [];
  const availableCategories: LeaderboardCategoryOption[] =
    filtersQuery.data?.categories ?? [];
  const allRows: LeaderboardRow[] = leaderboardQuery.data?.rows ?? [];

  const rows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          row.questSlug === questSlug &&
          (selectedCategoryId === "all" ||
            row.categoryId === selectedCategoryId),
      ),
    [allRows, questSlug, selectedCategoryId],
  );

  const tableBodyKey = `${questSlug}-${selectedCategoryId}`;
  const selectedQuest =
    questOptions.find((questOption) => questOption.slug === questSlug) ?? null;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!questSelectRef.current) return;
      if (questSelectRef.current.contains(event.target as Node)) return;
      setIsQuestMenuOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    setIsQuestMenuOpen(false);
  }, [questSlug]);

  return (
    <AnimatedCard delay={delay} className="p-6 shadow-2xl shadow-black/20">
      <div className="mb-6 flex flex-col gap-4">
        <div className="mb-6 flex justify-start">
          <div className="flex max-w-2xl items-start gap-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
              <p className="mt-1 text-sm text-gray-400">
                Best runs for each quest.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <label className="w-full text-sm text-gray-300 xl:max-w-md">
            <span className="mb-2 flex items-center gap-2 text-xs tracking-[0.22em] text-gray-500 uppercase">
              <CalendarDays className="h-3.5 w-3.5" />
              Quest
            </span>
            <div ref={questSelectRef} className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isQuestMenuOpen}
                onClick={() => setIsQuestMenuOpen((current) => !current)}
                className="relative w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 pr-12 text-left text-sm text-gray-100 transition-colors outline-none hover:border-amber-400 focus-visible:border-amber-400"
              >
                <span className="block truncate">
                  {selectedQuest
                    ? `${selectedQuest.title} · ${selectedQuest.difficultyStars}★ ${selectedQuest.monster} · ${selectedQuest.areaLabel}`
                    : "Select quest"}
                </span>
                <ChevronDown
                  className={`pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 ${
                    isQuestMenuOpen ? "rotate-180 text-amber-300" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {isQuestMenuOpen ? (
                  <motion.div
                    key="quest-menu"
                    role="listbox"
                    initial={{ opacity: 0, y: -4, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.99 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                  >
                    {questOptions.map((questOption) => {
                      const isSelected = questOption.slug === questSlug;
                      return (
                        <button
                          key={questOption.slug}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => setQuestSlug(questOption.slug)}
                          className={`flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors ${
                            isSelected
                              ? "bg-amber-400/15 text-amber-100"
                              : "text-gray-200 hover:bg-white/7"
                          }`}
                        >
                          <span className="truncate text-sm font-medium">
                            {questOption.title}
                          </span>
                          <span className="truncate text-xs text-gray-400">
                            {questOption.difficultyStars}★ {questOption.monster}{" "}
                            · {questOption.areaLabel}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </label>

          <div className="w-full xl:ml-auto xl:max-w-3xl">
            <div className="mb-2 flex items-center justify-end gap-2 text-xs tracking-[0.22em] text-gray-500 uppercase">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              {(
                [
                  "all",
                  ...availableCategories.map((category) => category.id),
                ] as const
              ).map((categoryId) => {
                const isActive = selectedCategoryId === categoryId;
                const category = availableCategories.find(
                  (item) => item.id === categoryId,
                );
                const label =
                  categoryId === "all"
                    ? "All"
                    : (category?.label ?? categoryId);
                const showCategoryIcon =
                  categoryId !== "all" && Boolean(category);
                const colorClasses =
                  categoryId === "all" || !category
                    ? {
                        active:
                          "border-amber-300 bg-amber-400 text-gray-950 shadow-lg shadow-amber-400/20",
                        inactive:
                          "border-gray-700 bg-white/5 text-gray-300 hover:border-amber-300 hover:bg-amber-400/15 hover:text-amber-100",
                      }
                    : categoryColorClasses[category.color];
                const CategoryIcon =
                  categoryId === "all" || !category
                    ? Filter
                    : categoryIconMap[category.icon];

                return (
                  <button
                    key={categoryId}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setSelectedCategoryId(categoryId)}
                    className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs leading-none font-medium transition-all duration-200 ${
                      isActive ? colorClasses.active : colorClasses.inactive
                    }`}
                  >
                    {showCategoryIcon ? (
                      <CategoryIcon className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs tracking-[0.2em] text-gray-500 uppercase">
              <th className="border-b border-gray-800 px-3 py-3">Rank</th>
              <th className="border-b border-gray-800 px-3 py-3">Runner</th>
              <th className="border-b border-gray-800 px-3 py-3">Weapons</th>
              <th className="border-b border-gray-800 px-3 py-3">Category</th>
              <th className="border-b border-gray-800 px-3 py-3">Tags</th>
              <th className="border-b border-gray-800 px-3 py-3 text-right">
                Time
              </th>
            </tr>
          </thead>
          <AnimatePresence mode="wait" initial={false}>
            {leaderboardQuery.isLoading ? (
              <motion.tbody
                key="table-loading"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <tr key={`loading-row-${rowIndex}`}>
                    <td className="px-3 py-4 align-middle">
                      <motion.div
                        className="h-8 w-8 rounded-full border border-gray-700 bg-white/8"
                        animate={{ opacity: [0.35, 0.75, 0.35] }}
                        transition={{
                          duration: 1.15,
                          repeat: Infinity,
                          delay: rowIndex * 0.08,
                        }}
                      />
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="h-10 w-10 rounded-full border border-gray-700 bg-white/8"
                          animate={{ opacity: [0.35, 0.75, 0.35] }}
                          transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            delay: rowIndex * 0.08 + 0.06,
                          }}
                        />
                        <div className="w-44 space-y-2">
                          <motion.div
                            className="h-3.5 w-3/4 rounded bg-white/10"
                            animate={{ opacity: [0.35, 0.78, 0.35] }}
                            transition={{
                              duration: 1.15,
                              repeat: Infinity,
                              delay: rowIndex * 0.08 + 0.12,
                            }}
                          />
                          <motion.div
                            className="h-3 w-1/2 rounded bg-white/8"
                            animate={{ opacity: [0.32, 0.7, 0.32] }}
                            transition={{
                              duration: 1.15,
                              repeat: Infinity,
                              delay: rowIndex * 0.08 + 0.16,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <motion.div
                          className="h-7 w-7 rounded-md bg-white/10"
                          animate={{ opacity: [0.35, 0.78, 0.35] }}
                          transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            delay: rowIndex * 0.08 + 0.2,
                          }}
                        />
                        <motion.div
                          className="h-7 w-7 rounded-md bg-white/8"
                          animate={{ opacity: [0.32, 0.7, 0.32] }}
                          transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            delay: rowIndex * 0.08 + 0.24,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <motion.div
                        className="h-6 w-28 rounded-full bg-white/10"
                        animate={{ opacity: [0.35, 0.78, 0.35] }}
                        transition={{
                          duration: 1.15,
                          repeat: Infinity,
                          delay: rowIndex * 0.08 + 0.28,
                        }}
                      />
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <motion.div
                        className="h-6 w-20 rounded-full bg-white/8"
                        animate={{ opacity: [0.32, 0.7, 0.32] }}
                        transition={{
                          duration: 1.15,
                          repeat: Infinity,
                          delay: rowIndex * 0.08 + 0.32,
                        }}
                      />
                    </td>
                    <td className="px-3 py-4 text-right align-middle">
                      <motion.div
                        className="ml-auto h-4 w-20 rounded bg-white/10"
                        animate={{ opacity: [0.35, 0.78, 0.35] }}
                        transition={{
                          duration: 1.15,
                          repeat: Infinity,
                          delay: rowIndex * 0.08 + 0.36,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </motion.tbody>
            ) : rows.length > 0 ? (
              <motion.tbody
                key={`rows-${tableBodyKey}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                {rows.map((row, index) => {
                  const CategoryIcon =
                    categoryIconMap[row.categoryIcon] ?? Layers;
                  const tone =
                    categoryColorClasses[row.categoryColor] ??
                    categoryColorClasses.amber;

                  return (
                    <motion.tr
                      key={row.runId}
                      layout
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/runs/${row.runId}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/runs/${row.runId}`);
                        }
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="group cursor-pointer border-b border-gray-800/70 transition-colors hover:bg-white/5"
                    >
                      <td className="px-3 py-4 align-middle">
                        <div className="justify-left flex items-center">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${
                              row.rank === 1
                                ? "border-amber-300/40 bg-amber-300/10 text-amber-300"
                                : row.rank === 2
                                  ? "border-gray-300/40 bg-gray-300/10 text-gray-200"
                                  : row.rank === 3
                                    ? "border-orange-400/40 bg-orange-400/10 text-orange-300"
                                    : "border-gray-700 bg-white/5 text-gray-300"
                            }`}
                          >
                            {row.rank}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5 text-sm font-semibold text-gray-300">
                            {row.userImage ? (
                              <img
                                src={row.userImage}
                                alt={row.userName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              row.userName.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {row.userName}
                            </div>
                            <div className="truncate text-xs text-gray-400">
                              {row.hunterName}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        <div className="flex items-center gap-2">
                          <img
                            src={`/weapons/${row.primaryWeaponKey}.png`}
                            alt={row.primaryWeaponLabel}
                            title={row.primaryWeaponLabel}
                            className="h-7 w-7 object-contain"
                          />
                          {row.secondaryWeaponKey ? (
                            <img
                              src={`/weapons/${row.secondaryWeaponKey}.png`}
                              alt={
                                row.secondaryWeaponLabel ??
                                row.secondaryWeaponKey
                              }
                              title={
                                row.secondaryWeaponLabel ??
                                row.secondaryWeaponKey
                              }
                              className="h-7 w-7 object-contain"
                            />
                          ) : null}
                        </div>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        <span
                          className={`inline-flex h-6 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs leading-none ${tone.badge}`}
                        >
                          <CategoryIcon
                            className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`}
                          />
                          {row.categoryLabel}
                        </span>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.tagLabels.length > 0 ? (
                            row.tagLabels.map((tagLabel) => (
                              <span
                                key={`${row.runId}-${tagLabel}`}
                                className="inline-flex h-6 items-center justify-center gap-1.5 rounded-full border border-gray-700 bg-white/5 px-2.5 text-xs leading-none text-gray-300 transition-all hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-amber-200 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_6px_18px_rgba(251,191,36,0.1)]"
                              >
                                <Tag className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                {tagLabel}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-4 text-right align-middle">
                        <div className="text-lg font-semibold text-amber-300">
                          {row.runTimeLabel}
                        </div>
                        <div className="text-xs text-gray-400">
                          {row.submittedAtLabel}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            ) : (
              <motion.tbody
                key={`empty-${tableBodyKey}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-gray-400"
                  >
                    No runs found :(
                  </td>
                </tr>
              </motion.tbody>
            )}
          </AnimatePresence>
        </table>
      </div>
    </AnimatedCard>
  );
}
