import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getAdminUsers, updateUserRole } from "~/server/lib/admin";

const userRoleSchema = z.enum(["runner", "moderator", "admin"]);

export const adminRouter = createTRPCRouter({
  listUsers: protectedProcedure.query(({ ctx }) => {
    if (ctx.session.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
    }

    return getAdminUsers();
  }),

  updateUserRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().trim().min(1),
        role: userRoleSchema,
      }),
    )
    .mutation(({ input, ctx }) => {
      if (ctx.session.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
      }

      return updateUserRole(input.userId, input.role);
    }),
});
