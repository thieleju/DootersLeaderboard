import HomeCtaCard from "./_components/submit-run-card";
import HomeStatsCards from "./_components/stats-cards";
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

      <HomeCtaCard delay={8} />
    </div>
  );
}
