import { leaderboardRouter } from "~/server/api/routers/leaderboard";
import { playersRouter } from "~/server/api/routers/players";
import { statsRouter } from "~/server/api/routers/stats";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  leaderboard: leaderboardRouter,
  players: playersRouter,
  stats: statsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.health.check();
 *       ^? { ok: true }
 */
export const createCaller = createCallerFactory(appRouter);
