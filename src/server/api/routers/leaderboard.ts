import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getHomeStats } from "~/server/data/home-stats";
import {
  getLeaderboardFilters,
  getLeaderboardRows,
} from "~/server/data/leaderboard";

export const leaderboardRouter = createTRPCRouter({
  filters: publicProcedure.query(() => getLeaderboardFilters()),

  getLeaderboard: publicProcedure.query(() => getLeaderboardRows()),

  stats: publicProcedure.query(() => getHomeStats()),
});
