import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  getLeaderboardFilters,
  getLeaderboardRows,
} from "~/server/lib/leaderboard";

export const leaderboardRouter = createTRPCRouter({
  filters: publicProcedure.query(() => getLeaderboardFilters()),

  getLeaderboard: publicProcedure.query(() => getLeaderboardRows()),
});
