"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { iconToneClasses, type UiTone } from "./theme-classes";

export interface DataTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  className?: string;
}

export type DataTableIconColor = UiTone;

interface DataTableProps {
  columns: DataTableColumn[];
  title?: string;
  description?: string;
  icon?: ReactNode;
  iconColor?: DataTableIconColor;
  headerContent?: ReactNode;
  tableWrapperClassName?: string;
  children: ReactNode;
}

const podiumBadgeClassByPlace = {
  1: "border-amber-300/40 bg-amber-300/10 text-amber-300",
  2: "border-gray-300/40 bg-gray-300/10 text-gray-200",
  3: "border-orange-400/40 bg-orange-400/10 text-orange-300"
} as const;

function getPodiumBadgeClass(value: number) {
  return (
    podiumBadgeClassByPlace[value as keyof typeof podiumBadgeClassByPlace] ??
    "border-gray-700 bg-white/5 text-gray-300"
  );
}

export function getRankBadgeClass(rank: number) {
  return getPodiumBadgeClass(rank);
}

export function getPlacementBadgeClass(placement: number) {
  return getPodiumBadgeClass(placement);
}

export function getRelativeTime(timestampMs: number) {
  const deltaSeconds = Math.round((timestampMs - Date.now()) / 1000);
  const absSeconds = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSeconds < 60) return rtf.format(deltaSeconds, "second");

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (Math.abs(deltaMinutes) < 60) return rtf.format(deltaMinutes, "minute");

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) return rtf.format(deltaHours, "hour");

  const deltaDays = Math.round(deltaHours / 24);
  if (Math.abs(deltaDays) < 30) return rtf.format(deltaDays, "day");

  const deltaMonths = Math.round(deltaDays / 30);
  if (Math.abs(deltaMonths) < 12) return rtf.format(deltaMonths, "month");

  const deltaYears = Math.round(deltaMonths / 12);
  return rtf.format(deltaYears, "year");
}

interface DataTableLoadingStateProps {
  columnCount: number;
  label?: string;
}

export function DataTableLoadingState({
  columnCount,
  label = "Loading..."
}: DataTableLoadingStateProps) {
  return (
    <motion.tbody
      key="table-loading"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <tr>
        <td
          colSpan={columnCount}
          className="px-3 py-8 text-center align-middle"
        >
          <motion.div
            className="inline-flex items-center gap-3 text-sm text-gray-400"
            animate={{ opacity: [0.45, 0.9, 0.45] }}
            transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="h-2 w-2 rounded-full bg-amber-300/70" />
            <span>{label}</span>
          </motion.div>
        </td>
      </tr>
    </motion.tbody>
  );
}

export default function DataTable({
  columns,
  title,
  description,
  icon,
  iconColor = "amber",
  headerContent,
  tableWrapperClassName,
  children
}: DataTableProps) {
  return (
    <>
      {title || description || icon || headerContent ? (
        <div className="mb-6 flex flex-col gap-4">
          {title || description || icon ? (
            <div className="mb-6 flex justify-start">
              <div className="flex max-w-2xl items-start gap-3 text-left">
                {icon ? (
                  <div
                    className={`flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full border ${iconToneClasses[iconColor]}`}
                  >
                    {icon}
                  </div>
                ) : null}
                <div>
                  {title ? (
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                  ) : null}
                  {description ? (
                    <p className="mt-1 w-full text-sm text-gray-400">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {headerContent}
        </div>
      ) : null}

      <div
        className={
          tableWrapperClassName ??
          "no-scrollbar overflow-x-auto overflow-y-visible"
        }
      >
        <table className="min-w-full border-separate border-spacing-0 overflow-visible">
          <thead>
            <tr className="text-left text-xs tracking-[0.2em] text-gray-500 uppercase">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-gray-800 px-3 py-3 ${
                    column.align === "right" ? "text-right" : ""
                  } ${column.className ?? ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <AnimatePresence mode="wait">{children}</AnimatePresence>
        </table>
      </div>
    </>
  );
}
