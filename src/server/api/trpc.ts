import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { users as usersTable } from "~/server/db/schema";
import type { UserRole } from "~/server/types/leaderboard";

/**
 * 1. CONTEXT
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * 2. INIT
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
      }
    };
  }
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/**
 * Middleware: timing
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms`);

  return result;
});

/**
 * Public procedure
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected base
 */
const protectedProcedureBase = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    await db
      .update(usersTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(usersTable.id, ctx.session.user.id));

    return next({
      ctx: {
        ...ctx,
        session: ctx.session
      }
    });
  });

/**
 * Role middleware
 */
function requireRole(allowedRoles: UserRole[]) {
  return t.middleware(async ({ ctx, next }) => {
    const role = ctx.session?.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next({
      ctx: {
        session: ctx.session
      }
    });
  });
}

/**
 * Protected procedures
 */
export const protectedProcedureRunner = protectedProcedureBase;

export const protectedProcedureModerator = protectedProcedureBase.use(
  requireRole(["moderator", "admin"])
);

export const protectedProcedureAdmin = protectedProcedureBase.use(
  requireRole(["admin"])
);

/**
 * Alias
 */
export const protectedProcedure = protectedProcedureRunner;
