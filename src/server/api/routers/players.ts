import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure
} from "~/server/api/trpc";
import {
  approveRun,
  rejectRun,
  getPlayerProfile,
  getPlayersOverview,
  getRunCategories,
  getSubmitRunOptions,
  deleteRun,
  submitRun
} from "~/server/lib/players";
import { submitRunInputSchema } from "~/server/validation/players";

export const playersRouter = createTRPCRouter({
  list: publicProcedure.query(() => getPlayersOverview()),

  profile: publicProcedure
    .input(
      z.object({
        userId: z.string().trim().min(1)
      })
    )
    .query(({ input, ctx }) =>
      getPlayerProfile(
        input.userId,
        ctx.session?.user?.id,
        ctx.session?.user?.role
      )
    ),

  submitOptions: publicProcedure.query(() => getSubmitRunOptions()),

  categories: publicProcedure.query(() => getRunCategories()),

  submitRun: protectedProcedure
    .input(submitRunInputSchema)
    .mutation(({ input, ctx }) => submitRun(input, ctx.session.user.id)),

  deleteRun: protectedProcedure
    .input(
      z.object({
        runId: z.string().trim().min(1)
      })
    )
    .mutation(({ input, ctx }) =>
      deleteRun(input.runId, ctx.session.user.id, ctx.session.user.role)
    ),

  approveRun: protectedProcedure
    .input(
      z.object({
        runId: z.string().trim().min(1)
      })
    )
    .mutation(({ input, ctx }) =>
      approveRun(input.runId, ctx.session.user.id, ctx.session.user.role)
    ),

  rejectRun: protectedProcedure
    .input(
      z.object({
        runId: z.string().trim().min(1)
      })
    )
    .mutation(({ input, ctx }) =>
      rejectRun(input.runId, ctx.session.user.id, ctx.session.user.role)
    )
});
