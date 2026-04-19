"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Filter,
  Flame,
  Layers,
  Shield,
  Sword,
  Tag,
  Trophy
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { extractYouTubeVideoId } from "~/lib/youtube";
import { api } from "~/trpc/react";
import type {
  LeaderboardCategoryFilterKey,
  LeaderboardCategoryOption,
  LeaderboardQuestOption,
  LeaderboardRow
} from "~/server/types/leaderboard";
import AnimatedCard from "./animated-card";
import CategoryTooltip from "./category-tooltip";
import DataTable, {
  DataTableLoadingState,
  getRankBadgeClass
} from "./data-table";
import LazyScreenshotImage from "./lazy-screenshot-image";
import { formatCountLabel, formatFullDateTime, formatRunTime } from "./helpers";
import { categoryToneClasses } from "./theme-classes";

const categoryIconMap = {
  flame: Flame,
  shield: Shield,
  "book-open": BookOpen,
  sword: Sword
} as const;

interface LeaderboardTableProps {
  delay?: number;
}

export default function LeaderboardTable({ delay = 0 }: LeaderboardTableProps) {
  const questSelectRef = useRef<HTMLDivElement | null>(null);
  const filtersQuery = api.leaderboard.filters.useQuery(undefined, {
    staleTime: Infinity
  });
  const allCategoriesQuery = api.players.categories.useQuery(undefined, {
    staleTime: Infinity
  });
  const [questId, setQuestId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<LeaderboardCategoryFilterKey>("all");
  const [isQuestMenuOpen, setIsQuestMenuOpen] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!questId && filtersQuery.data?.defaultQuestId) {
      setQuestId(filtersQuery.data.defaultQuestId);
    }
  }, [filtersQuery.data?.defaultQuestId, questId]);

  const leaderboardQuery = api.leaderboard.getLeaderboard.useQuery(undefined, {
    staleTime: Infinity
  });

  const questOptions: LeaderboardQuestOption[] =
    filtersQuery.data?.quests ?? [];
  const availableCategories: LeaderboardCategoryOption[] =
    filtersQuery.data?.categories ?? [];
  const allCategories: LeaderboardCategoryOption[] =
    allCategoriesQuery.data ?? [];

  const rows = useMemo(() => {
    const allRows: LeaderboardRow[] = leaderboardQuery.data?.rows ?? [];
    return allRows.filter(
      (row) =>
        row.questId === questId &&
        (selectedCategoryId === "all" || row.categoryId === selectedCategoryId)
    );
  }, [leaderboardQuery.data?.rows, questId, selectedCategoryId]);

  const tableBodyKey = `${questId}-${selectedCategoryId}`;
  const selectedQuest =
    questOptions.find((questOption) => questOption.id === questId) ?? null;

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
  }, [questId]);

  useEffect(() => {
    setExpandedRunId(null);
  }, [questId, selectedCategoryId]);

  return (
    <AnimatedCard
      delay={delay}
      className="relative z-30 p-6 shadow-2xl shadow-black/20"
    >
      <DataTable
        title="Quest Leaderboard"
        description="Every quest has one leaderboard, use the filters to change the quest and category."
        icon={<Trophy className="h-6 w-6" />}
        headerContent={
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
                      ? `${selectedQuest.title} · ${selectedQuest.difficultyStars}★ ${selectedQuest.monster} · ${selectedQuest.areaLabel} · ${formatCountLabel(selectedQuest.approvedRunCount ?? 0, "run")}`
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
                      className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-sm"
                    >
                      {questOptions.map((questOption) => {
                        const isSelected = questOption.id === questId;
                        return (
                          <button
                            key={questOption.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => setQuestId(questOption.id)}
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
                              {questOption.difficultyStars}★{" "}
                              {questOption.monster} · {questOption.areaLabel} ·{" "}
                              {formatCountLabel(
                                questOption.approvedRunCount ?? 0,
                                "run"
                              )}
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
                    ...availableCategories.map((category) => category.id)
                  ] as const
                ).map((categoryId) => {
                  const isActive = selectedCategoryId === categoryId;
                  const category = availableCategories.find(
                    (item) => item.id === categoryId
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
                            "border-amber-300 bg-amber-300 text-gray-950 shadow-lg shadow-amber-400/20",
                          inactive:
                            "border-gray-700 bg-white/5 text-gray-300 hover:border-amber-300 hover:bg-amber-400/15 hover:text-amber-100"
                        }
                      : categoryToneClasses[category.color];
                  const CategoryIcon =
                    categoryId === "all" || !category
                      ? Filter
                      : categoryIconMap[category.icon];
                  const tooltipCategory =
                    categoryId === "all"
                      ? null
                      : availableCategories.find(
                          (item) => item.id === categoryId
                        );

                  const trigger = (
                    <button
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

                  if (!tooltipCategory) {
                    return <div key={categoryId}>{trigger}</div>;
                  }

                  return (
                    <CategoryTooltip
                      key={categoryId}
                      label={tooltipCategory.label}
                      description={tooltipCategory.description}
                      link={tooltipCategory.link}
                    >
                      {trigger}
                    </CategoryTooltip>
                  );
                })}
              </div>
            </div>
          </div>
        }
        columns={[
          { key: "rank", label: "Rank" },
          { key: "runner", label: "Runner" },
          { key: "weapons", label: "Weapons" },
          { key: "category", label: "Category" },
          { key: "tags", label: "Tags" },
          { key: "score", label: "Score", align: "right" },
          { key: "time", label: "Time", align: "right" }
        ]}
      >
        {leaderboardQuery.isLoading ? (
          <DataTableLoadingState
            columnCount={7}
            label="Loading leaderboard..."
          />
        ) : rows.length > 0 ? (
          <motion.tbody
            key={`rows-${tableBodyKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {rows.map((row, index) => {
              const isExpanded = expandedRunId === row.runId;
              const rowYoutubeLink =
                typeof row.youtubeLink === "string" ? row.youtubeLink : null;
              const rowYoutubeVideoId = rowYoutubeLink
                ? extractYouTubeVideoId(rowYoutubeLink)
                : null;
              const hasMedia = Boolean(rowYoutubeVideoId || row.hasScreenshot);
              const category = allCategories.find(
                (item) => item.id === row.categoryId
              );
              const CategoryIcon = category
                ? (categoryIconMap[category.icon] ?? Layers)
                : Layers;
              const tone = category
                ? (categoryToneClasses[category.color] ??
                  categoryToneClasses.amber)
                : categoryToneClasses.amber;

              return (
                <Fragment key={row.runId}>
                  <motion.tr
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className={`group cursor-pointer border-b border-gray-800/70 transition-colors ${
                      isExpanded ? "bg-white/6" : "hover:bg-white/5"
                    }`}
                    onClick={() => {
                      setExpandedRunId((current) =>
                        current === row.runId ? null : row.runId
                      );
                    }}
                  >
                    <td className="px-3 py-4 align-middle">
                      <div className="justify-left flex items-center">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${getRankBadgeClass(row.rank)}`}
                        >
                          {row.rank}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
                            isExpanded ? "rotate-180 text-amber-300" : ""
                          }`}
                        />
                        <Link
                          href={`/profile/${row.userId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex min-w-0 items-center gap-3 rounded-md transition-colors hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/40 focus-visible:outline-none"
                        >
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5 text-sm font-semibold text-gray-300">
                            {row.userImage ? (
                              <Image
                                src={row.userImage}
                                alt={row.userName}
                                width={40}
                                height={40}
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
                        </Link>
                      </div>
                    </td>

                    <td className="px-3 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <Image
                          src={`/weapons/${row.primaryWeaponKey}.png`}
                          alt={row.primaryWeaponKey.toUpperCase()}
                          title={row.primaryWeaponKey.toUpperCase()}
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                        />
                        {row.secondaryWeaponKey ? (
                          <Image
                            src={`/weapons/${row.secondaryWeaponKey}.png`}
                            alt={row.secondaryWeaponKey.toUpperCase()}
                            title={row.secondaryWeaponKey.toUpperCase()}
                            width={28}
                            height={28}
                            className="h-7 w-7 object-contain"
                          />
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-4 align-middle">
                      {category ? (
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
                      ) : (
                        <span
                          className={`inline-flex h-6 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs leading-none ${tone.badge}`}
                        >
                          <CategoryIcon
                            className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`}
                          />
                          {row.categoryId}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-4 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.tagLabels.length > 0 ? (
                          row.tagLabels.map((tagLabel) => (
                            <span
                              key={`${row.runId}-${tagLabel}`}
                              className="inline-flex h-6 items-center justify-center gap-1.5 rounded-full border border-gray-700 bg-white/5 px-2.5 text-xs leading-none whitespace-nowrap text-gray-300 transition-all hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-amber-200 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_6px_18px_rgba(251,191,36,0.1)]"
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
                        +{row.score.toLocaleString("en-US")}
                      </div>
                    </td>

                    <td className="px-3 py-4 text-right align-middle">
                      <div className="text-lg font-semibold text-amber-300">
                        {formatRunTime(row.runTimeMs)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatFullDateTime(row.submittedAtMs)}
                      </div>
                    </td>
                  </motion.tr>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.tr
                        key={`${row.runId}-details`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-b border-gray-800/70"
                      >
                        <td colSpan={7} className="px-0 py-0 align-top">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="bg-gray-900 px-4 py-4">
                              {hasMedia ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                  {rowYoutubeVideoId ? (
                                    <div className="space-y-1">
                                      <div className="text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                        Video
                                      </div>
                                      <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/35">
                                        <iframe
                                          className="aspect-video w-full"
                                          src={`https://www.youtube.com/embed/${rowYoutubeVideoId}`}
                                          title="YouTube video"
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                          referrerPolicy="strict-origin-when-cross-origin"
                                          allowFullScreen
                                        />
                                      </div>
                                    </div>
                                  ) : null}

                                  {row.hasScreenshot ? (
                                    <div className="space-y-1">
                                      <div className="text-[10px] tracking-[0.16em] text-gray-500 uppercase">
                                        Screenshot
                                      </div>
                                      <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-black/25">
                                        <LazyScreenshotImage
                                          runId={row.runId}
                                          alt="Run screenshot"
                                          className="h-auto w-full"
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
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
                colSpan={7}
                className="px-3 py-8 text-center text-sm text-gray-400"
              >
                No runs found yet.
              </td>
            </tr>
          </motion.tbody>
        )}
      </DataTable>
    </AnimatedCard>
  );
}
