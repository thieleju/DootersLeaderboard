import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  getPlayerProfile,
  getPlayersOverview,
  getSubmitRunOptions,
  submitRun,
} from "~/server/lib/players";
import { submitRunInputSchema } from "~/server/validation/players";

export const playersRouter = createTRPCRouter({
  list: publicProcedure.query(() => getPlayersOverview()),

  profile: publicProcedure
    .input(
      z.object({
        userId: z.string().trim().min(1),
      }),
    )
    .query(({ input, ctx }) =>
      getPlayerProfile(
        input.userId,
        ctx.session?.user?.id,
        ctx.session?.user?.role,
      ),
    ),

  submitOptions: publicProcedure.query(() => getSubmitRunOptions()),

  submitRun: protectedProcedure
    .input(submitRunInputSchema)
    .mutation(({ input, ctx }) => submitRun(input, ctx.session.user.id)),
});
