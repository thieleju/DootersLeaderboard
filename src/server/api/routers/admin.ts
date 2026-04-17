import { z } from "zod";

import { BOT_NOTIFICATION_EVENT_KEYS } from "~/constants";
import { createTRPCRouter, protectedProcedureAdmin } from "~/server/api/trpc";
import {
  getAdminUsers,
  getBotChannels,
  getBotGuilds,
  getBotNotificationSettings,
  updateUserRole,
  upsertBotNotificationSetting
} from "~/server/lib/admin";

const userRoleSchema = z.enum(["runner", "moderator", "admin"]);

export const adminRouter = createTRPCRouter({
  listUsers: protectedProcedureAdmin.query(({}) => getAdminUsers()),

  listBotNotificationSettings: protectedProcedureAdmin.query(() =>
    getBotNotificationSettings()
  ),

  upsertBotNotificationSetting: protectedProcedureAdmin
    .input(
      z.object({
        eventKey: z.enum(BOT_NOTIFICATION_EVENT_KEYS),
        enabled: z.boolean(),
        guildId: z.string().trim().max(64).optional(),
        channelId: z.string().trim().max(64).optional()
      })
    )
    .mutation(({ input }) => upsertBotNotificationSetting(input)),

  updateUserRole: protectedProcedureAdmin
    .input(
      z.object({
        userId: z.string().trim().min(1),
        role: userRoleSchema
      })
    )
    .mutation(({ input, ctx }) =>
      updateUserRole(input.userId, input.role, ctx.session!.user.id)
    ),

  listBotGuilds: protectedProcedureAdmin.query(() => getBotGuilds()),

  listBotChannels: protectedProcedureAdmin
    .input(z.object({ guildId: z.string() }))
    .query(({ input }) => getBotChannels(input.guildId))
});
