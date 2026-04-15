"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Award, Swords, Upload, Users } from "lucide-react";

import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function ValueSkeleton() {
  return (
    <motion.div
      className="h-8 w-16 rounded-md bg-gradient-to-r from-white/6 via-amber-200/15 to-white/6"
      initial={{ opacity: 0.35, scaleX: 0.94 }}
      animate={{ opacity: [0.35, 0.82, 0.35], scaleX: [0.94, 1, 0.94] }}
      transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function SubtitleSkeleton() {
  return (
    <motion.div
      className="mt-3 h-3 w-24 rounded bg-white/10"
      initial={{ opacity: 0.35 }}
      animate={{ opacity: [0.35, 0.7, 0.35] }}
      transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function HomeStatsCards() {
  const statsQuery = api.stats.getHomeStats.useQuery(undefined, {
    staleTime: Infinity,
  });

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;

  return (
    <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
      <AnimatedCard interactive className="p-6 text-center">
        <div className="mb-3 flex justify-center">
          <Users className="h-8 w-8 text-cyan-400" />
        </div>
        <div className="mb-2 text-sm text-gray-400">Active Runners</div>
        <div className="flex h-8 items-center justify-center text-2xl leading-none font-bold text-white">
          {stats ? formatNumber(stats.activeRunnerCount) : <ValueSkeleton />}
        </div>
        {isLoading ? (
          <div className="flex justify-center">
            <SubtitleSkeleton />
          </div>
        ) : (
          <Link
            href="/players"
            className="mt-3 inline-flex text-xs text-cyan-300 transition-colors hover:text-cyan-200"
          >
            View players
          </Link>
        )}
      </AnimatedCard>

      <AnimatedCard interactive delay={1} className="p-6 text-center">
        <div className="mb-3 flex justify-center">
          <Upload className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="mb-2 text-sm text-gray-400">Uploaded Runs</div>
        <div className="flex h-8 items-center justify-center text-2xl leading-none font-bold text-white">
          {stats ? formatNumber(stats.uploadedRunCount) : <ValueSkeleton />}
        </div>
        {isLoading ? (
          <div className="flex justify-center">
            <SubtitleSkeleton />
          </div>
        ) : (
          <div className="mt-3 text-xs text-emerald-300">All submissions</div>
        )}
      </AnimatedCard>

      <AnimatedCard interactive delay={2} className="p-6 text-center">
        <div className="mb-3 flex justify-center">
          <Swords className="h-8 w-8 text-violet-400" />
        </div>
        <div className="mb-2 text-sm text-gray-400">Most Played Weapon</div>
        {stats?.mostPlayedWeapon ? (
          <>
            <div className="mb-2 flex h-8 items-center justify-center gap-2">
              <img
                src={`/weapons/${stats.mostPlayedWeapon.key}.png`}
                alt={stats.mostPlayedWeapon.label}
                className="h-5 w-5 object-contain"
              />
              <span className="text-lg leading-none font-semibold text-white">
                {stats.mostPlayedWeapon.label}
              </span>
            </div>
            <div className="mt-3 text-xs text-amber-300">
              {formatNumber(stats.mostPlayedWeapon.count)} runs
            </div>
          </>
        ) : isLoading ? (
          <>
            <div className="mb-2 flex h-8 items-center justify-center gap-2">
              <motion.div
                className="h-5 w-5 rounded bg-white/10"
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="h-5 w-28 rounded bg-white/10"
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{
                  duration: 1.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.12,
                }}
              />
            </div>
            <div className="flex justify-center">
              <SubtitleSkeleton />
            </div>
          </>
        ) : (
          <div className="flex h-8 items-center justify-center text-2xl leading-none font-bold text-white">
            -
          </div>
        )}
      </AnimatedCard>

      <AnimatedCard interactive delay={3} className="p-6 text-center">
        <div className="mb-3 flex justify-center">
          <Award className="h-8 w-8 text-amber-400" />
        </div>
        <div className="mb-2 text-sm text-gray-400">Top Runner</div>
        {stats?.topRunner ? (
          <div className="space-y-1">
            <div className="flex h-8 items-center justify-center truncate px-1 text-lg leading-none font-semibold text-white">
              {stats.topRunner.userName}
            </div>
            <div className="text-xs text-amber-300">
              {stats.topRunner.firstPlaceCount}x #1 placements
            </div>
            <div className="text-xs text-gray-400">
              {stats.topRunner.podiumCount}x Top 3 · Best rank #
              {stats.topRunner.bestRank}
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <div className="flex justify-center">
              <ValueSkeleton />
            </div>
            <div className="flex justify-center">
              <SubtitleSkeleton />
            </div>
          </div>
        ) : (
          <div className="flex h-8 items-center justify-center text-2xl leading-none font-bold text-white">
            -
          </div>
        )}
      </AnimatedCard>
    </div>
  );
}
