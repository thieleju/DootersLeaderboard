"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { CalendarDays, Trophy, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";
import DataTable, {
  DataTableLoadingState,
  getRankBadgeClass,
  getRelativeTime
} from "./data-table";
import PlacementBadges from "./placement-badges";

interface PlayersTableProps {
  delay?: number;
  onInitialReady?: () => void;
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PlayersTable({
  delay = 0,
  onInitialReady
}: PlayersTableProps) {
  const router = useRouter();
  const playersQuery = api.players.list.useQuery(undefined, {
    staleTime: Infinity
  });

  useEffect(() => {
    if (!onInitialReady) return;
    if (playersQuery.isLoading) return;

    const rowCount = playersQuery.data?.length ?? 0;
    const totalDelayMs = Math.min(900, 320 + rowCount * 30);
    const timeout = window.setTimeout(() => onInitialReady(), totalDelayMs);

    return () => window.clearTimeout(timeout);
  }, [onInitialReady, playersQuery.data, playersQuery.isLoading]);

  return (
    <AnimatedCard delay={delay} className="p-6 shadow-2xl shadow-black/20">
      <DataTable
        title="Global Rankings"
        description="All Dooters are ranked by their overall score, calculated as the sum of their scores from each quest."
        icon={<Trophy className="h-6 w-6" />}
        columns={[
          { key: "rank", label: "Rank" },
          { key: "runner", label: "Runner" },
          { key: "most-used", label: "Most Used", className: "text-center" },
          { key: "top3", label: "Top 3", className: "text-center" },
          {
            key: "last-submitted",
            label: "Last Submitted Run",
            className: "text-center"
          },
          { key: "score", label: "Overall Score", className: "text-center" }
        ]}
      >
        {playersQuery.isLoading ? (
          <DataTableLoadingState columnCount={6} label="Loading ranking..." />
        ) : (
          <motion.tbody
            key="players-rows"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {(playersQuery.data ?? []).map((player, index) => (
              <motion.tr
                key={player.userId}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/profile/${player.userId}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/profile/${player.userId}`);
                  }
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="cursor-pointer border-b border-gray-800/70 text-sm transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-4 align-middle">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${getRankBadgeClass(index + 1)}`}
                  >
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 py-4 align-middle">
                  <div className="inline-flex items-center gap-3 text-gray-200">
                    <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5">
                      {player.avatar ? (
                        <Image
                          src={player.avatar}
                          alt={player.displayName}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound className="h-4 w-4 text-gray-400" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {player.displayName}
                      </span>
                      <span className="block truncate text-xs text-gray-400">
                        {player.hunterName}
                      </span>
                    </span>
                  </div>
                </td>

                <td className="px-3 py-4 text-center align-middle text-gray-300">
                  {player.mostUsedWeapon ? (
                    <span className="inline-flex items-center">
                      <Image
                        src={`/weapons/${player.mostUsedWeapon.key}.png`}
                        alt={player.mostUsedWeapon.label}
                        title={player.mostUsedWeapon.label}
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                      />
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-4 text-center align-middle">
                  <PlacementBadges
                    className="justify-center"
                    first={player.top3Placements.first}
                    second={player.top3Placements.second}
                    third={player.top3Placements.third}
                  />
                </td>
                <td className="px-3 py-4 text-center align-middle">
                  <div className="inline-flex items-center gap-2 text-gray-300">
                    <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-200">
                        {capitalizeFirst(
                          getRelativeTime(player.lastSubmittedAtMs)
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(player.lastSubmittedAtMs).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 text-center align-middle">
                  <div className="text-lg font-semibold text-amber-300">
                    {Math.round(player.score).toLocaleString("en-US")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {player.submittedRunsCount}{" "}
                    {player.submittedRunsCount === 1 ? "run" : "runs"}
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        )}
      </DataTable>

      {!playersQuery.isLoading && (playersQuery.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
          No ranking entries found. Only players with at least one approved run
          are shown here.
        </div>
      ) : null}
    </AnimatedCard>
  );
}
