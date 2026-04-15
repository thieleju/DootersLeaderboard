import Link from "next/link";

import AnimatedCard from "./_components/animated-card";
import HomeStatsCards from "./_components/home-stats-cards";
import LeaderboardTable from "./_components/leaderboard-table";

export default function Home() {
  return (
    <div className="mt-10 mb-20 space-y-12">
      <div className="space-y-4 text-center">
        <h1 className="text-6xl font-bold text-white">Dooters Leaderboard</h1>
        <p className="text-xl text-gray-400">
          Leaderboard for Monster Hunter Wilds speedruns
        </p>
      </div>

      <HomeStatsCards />

      <LeaderboardTable delay={5} />

      <AnimatedCard delay={8} className="p-8 text-center">
        <div className="mb-8 text-gray-300">
          To submit a run, log in with your discord account.
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="rounded bg-amber-400 px-6 py-2 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
          >
            Login
          </Link>
          <Link
            href="/players"
            className="rounded border border-gray-600 px-6 py-2 font-semibold text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-400"
          >
            View Players
          </Link>
        </div>
      </AnimatedCard>
    </div>
  );
}
