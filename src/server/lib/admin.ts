import "server-only";

import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { users as usersTable } from "~/server/db/schema";
import type { UserRole } from "~/server/types/leaderboard";

export type AdminUserRow = {
  id: string;
  displayName: string;
  username: string;
  image: string | null;
  role: UserRole;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.name,
      image: usersTable.image,
      role: usersTable.role,
    })
    .from(usersTable)
    .orderBy(asc(usersTable.displayName), asc(usersTable.name));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName ?? row.username ?? "Profile",
    username: row.username ?? "",
    image: row.image ?? null,
    role: row.role,
  }));
}

export async function updateUserRole(targetUserId: string, role: UserRole) {
  const existingUser = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existingUser) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, targetUserId));

  return { userId: targetUserId, role };
}
