import Link from "next/link";

import AnimatedCard from "./_components/animated-card";
import { Award, Play, Crown, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="mb-20 space-y-12">
      <div className="space-y-4 text-center">
        <h1 className="text-6xl font-bold text-white">Dooters Leaderboard</h1>
        <p className="text-xl text-gray-400">
          Leaderboard for Monster Hunter Wilds speedruns
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 min-[768px]:grid-cols-4">
        <AnimatedCard interactive delay={0} className="p-6 text-center">
          <div className="mb-3 flex justify-center">
            <Play className="h-8 w-8 text-green-500" />
          </div>
          <div className="mb-2 text-sm text-gray-400">Players</div>
          <div className="text-2xl font-bold text-white">0</div>
        </AnimatedCard>

        <AnimatedCard interactive delay={1} className="p-6 text-center">
          <div className="mb-3 flex justify-center">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div className="mb-2 text-sm text-gray-400">1st Place</div>
          <div className="text-2xl font-bold text-white">N/A</div>
        </AnimatedCard>

        <AnimatedCard interactive delay={2} className="p-6 text-center">
          <div className="mb-3 flex justify-center">
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
          <div className="mb-2 text-sm text-gray-400">Fastest</div>
          <div className="text-2xl font-bold text-white">N/A</div>
        </AnimatedCard>

        <AnimatedCard interactive delay={3} className="p-6 text-center">
          <div className="mb-3 flex justify-center">
            <Award className="h-8 w-8 text-amber-300" />
          </div>
          <div className="mb-2 text-sm text-gray-400">Finishers</div>
          <div className="text-2xl font-bold text-white">0</div>
        </AnimatedCard>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <AnimatedCard delay={4} className="p-8 lg:col-span-1">
          <h2 className="mb-6 text-2xl font-bold text-white">Leaderboard</h2>
          <div className="space-y-3">
            <div className="rounded border border-gray-700 bg-white/5 p-3">
              <div className="font-semibold text-white">No data yet</div>
              <div className="text-sm text-gray-400">
                Leaderboard will be updated soon
              </div>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={5} className="p-8 lg:col-span-1">
          <h2 className="mb-6 text-2xl font-bold text-white">Statistics</h2>
          <div className="space-y-3">
            <div className="rounded border border-gray-700 bg-white/5 p-3">
              <div className="text-sm font-semibold text-white">
                Statistics will be displayed here
              </div>
            </div>
          </div>
        </AnimatedCard>
      </div>

      <AnimatedCard delay={6} className="p-8 text-center">
        <div className="mb-4 text-gray-300">Welcome to Dooters Leaderboard</div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/players"
            className="rounded bg-amber-400 px-6 py-2 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
          >
            View Players
          </Link>
          <Link
            href="/info"
            className="rounded border border-gray-600 px-6 py-2 font-semibold text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-400"
          >
            Learn More
          </Link>
        </div>
      </AnimatedCard>
    </div>
  );
}
