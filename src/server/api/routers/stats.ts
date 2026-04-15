import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getHomeStats } from "~/server/lib/stats";

export const statsRouter = createTRPCRouter({
  getHomeStats: publicProcedure.query(() => getHomeStats())
});
