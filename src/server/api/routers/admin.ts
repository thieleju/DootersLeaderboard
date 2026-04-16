import { z } from "zod";

import { createTRPCRouter, protectedProcedureAdmin } from "~/server/api/trpc";
import { getAdminUsers, updateUserRole } from "~/server/lib/admin";

const userRoleSchema = z.enum(["runner", "moderator", "admin"]);

export const adminRouter = createTRPCRouter({
  listUsers: protectedProcedureAdmin.query(({}) => getAdminUsers()),

  updateUserRole: protectedProcedureAdmin
    .input(
      z.object({
        userId: z.string().trim().min(1),
        role: userRoleSchema
      })
    )
    .mutation(({ input, ctx }) =>
      updateUserRole(input.userId, input.role, ctx.session!.user.id)
    )
});
