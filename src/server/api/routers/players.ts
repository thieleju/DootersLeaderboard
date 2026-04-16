import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedureModerator,
  protectedProcedureRunner,
  publicProcedure
} from "~/server/api/trpc";
import {
  approveRun,
  getReviewedRunsForModeration,
  getPendingRunsForModeration,
  rejectRun,
  getPlayerProfile,
  getPlayersOverview,
  getRunCategories,
  getSubmitRunOptions,
  deleteRun,
  submitRun,
  updatePendingRunDetails,
  updatePendingRunTags
} from "~/server/lib/players";
import {
  moderateRunDetailsInputSchema,
  moderateRunTagsInputSchema,
  submitRunInputSchema
} from "~/server/validation/players";

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

  pendingRuns: protectedProcedureModerator.query(({ ctx }) =>
    getPendingRunsForModeration(ctx.session!.user.role)
  ),

  reviewedRuns: protectedProcedureModerator.query(({ ctx }) =>
    getReviewedRunsForModeration(ctx.session!.user.role)
  ),

  updatePendingRunTags: protectedProcedureModerator
    .input(moderateRunTagsInputSchema)
    .mutation(({ input, ctx }) =>
      updatePendingRunTags(input, ctx.session!.user.role)
    ),

  updatePendingRunDetails: protectedProcedureModerator
    .input(moderateRunDetailsInputSchema)
    .mutation(({ input, ctx }) =>
      updatePendingRunDetails(input, ctx.session!.user.role)
    ),

  submitRun: protectedProcedureRunner
    .input(submitRunInputSchema)
    .mutation(({ input, ctx }) => submitRun(input, ctx.session.user.id)),

  deleteRun: protectedProcedureRunner
    .input(
      z.object({
        runId: z.string().trim().min(1)
      })
    )
    .mutation(({ input, ctx }) =>
      deleteRun(input.runId, ctx.session.user.id, ctx.session.user.role)
    ),

  approveRun: protectedProcedureModerator
    .input(
      z.object({
        runId: z.string().trim().min(1)
      })
    )
    .mutation(({ input, ctx }) =>
      approveRun(input.runId, ctx.session!.user.id, ctx.session!.user.role)
    ),

  rejectRun: protectedProcedureModerator
    .input(
      z.object({
        runId: z.string().trim().min(1)
      })
    )
    .mutation(({ input, ctx }) =>
      rejectRun(input.runId, ctx.session!.user.id, ctx.session!.user.role)
    )
});
