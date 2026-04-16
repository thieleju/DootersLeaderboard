import {
  createTRPCRouter,
  protectedProcedureModerator
} from "~/server/api/trpc";
import {
  deleteQuest,
  createQuest,
  getQuestFormOptions,
  listQuests,
  updateQuest
} from "~/server/lib/quests";
import {
  questCreateInputSchema,
  questDeleteInputSchema,
  questUpdateInputSchema
} from "~/server/validation/quests";

export const questsRouter = createTRPCRouter({
  list: protectedProcedureModerator.query(() => listQuests()),

  formOptions: protectedProcedureModerator.query(() => getQuestFormOptions()),

  create: protectedProcedureModerator
    .input(questCreateInputSchema)
    .mutation(({ input }) => createQuest(input)),

  update: protectedProcedureModerator
    .input(questUpdateInputSchema)
    .mutation(({ input }) => updateQuest(input)),

  delete: protectedProcedureModerator
    .input(questDeleteInputSchema)
    .mutation(({ input }) => deleteQuest(input))
});
