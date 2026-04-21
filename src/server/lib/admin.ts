import "server-only";

import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";

import {
  BOT_NOTIFICATION_EVENT_KEYS,
  BOT_NOTIFICATION_EVENT_META,
  type BotNotificationEventKey
} from "~/constants";
import { db } from "~/server/db";
import {
  botChannels as botChannelsTable,
  botGuilds as botGuildsTable,
  botNotificationSettings as botNotificationSettingsTable,
  users as usersTable
} from "~/server/db/schema";
import type { UserRole } from "~/server/types/leaderboard";

export type AdminUserRow = {
  id: string;
  displayName: string;
  username: string;
  image: string | null;
  role: UserRole;
  lastLoginAtMs: number | null;
  lastSeenAtMs: number | null;
};

export type AdminBotNotificationSettingRow = {
  eventKey: BotNotificationEventKey;
  eventLabel: string;
  eventDescription: string;
  enabled: boolean;
  guildId: string;
  channelId: string;
  updatedAtMs: number | null;
};

export type AdminUserProfileUpdateInput = {
  displayName: string;
  name: string;
  image: string;
};

export type AdminUserProfileUpdateResult = {
  userId: string;
  displayName: string | null;
  name: string | null;
  image: string | null;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.name,
      image: usersTable.image,
      role: usersTable.role,
      lastLoginAt: usersTable.lastLoginAt,
      lastSeenAt: usersTable.lastSeenAt
    })
    .from(usersTable)
    .orderBy(asc(usersTable.displayName), asc(usersTable.name));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName ?? row.username ?? "Profile",
    username: row.username ?? "",
    image: row.image ?? null,
    role: row.role,
    lastLoginAtMs:
      row.lastLoginAt instanceof Date ? row.lastLoginAt.getTime() : null,
    lastSeenAtMs:
      row.lastSeenAt instanceof Date ? row.lastSeenAt.getTime() : null
  }));
}

export async function updateUserRole(
  targetUserId: string,
  role: UserRole,
  actorUserId: string
) {
  if (targetUserId === actorUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot change your own role"
    });
  }

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

export async function updateUserProfile(
  userId: string,
  input: AdminUserProfileUpdateInput
): Promise<AdminUserProfileUpdateResult> {
  const existingUser = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existingUser) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  const displayName = input.displayName.trim();
  const name = input.name.trim();
  const image = input.image.trim();

  await db
    .update(usersTable)
    .set({
      displayName: displayName || null,
      name: name || null,
      image: image || null
    })
    .where(eq(usersTable.id, userId));

  return {
    userId,
    displayName: displayName || null,
    name: name || null,
    image: image || null
  };
}

export async function getBotNotificationSettings(): Promise<
  AdminBotNotificationSettingRow[]
> {
  const rows = await db
    .select({
      eventKey: botNotificationSettingsTable.eventKey,
      enabled: botNotificationSettingsTable.enabled,
      guildId: botNotificationSettingsTable.guildId,
      channelId: botNotificationSettingsTable.channelId,
      updatedAt: botNotificationSettingsTable.updatedAt
    })
    .from(botNotificationSettingsTable);

  const rowByEventKey = new Map(rows.map((row) => [row.eventKey, row]));

  return BOT_NOTIFICATION_EVENT_KEYS.map((eventKey) => {
    const row = rowByEventKey.get(eventKey);
    const meta = BOT_NOTIFICATION_EVENT_META[eventKey];

    return {
      eventKey,
      eventLabel: meta.label,
      eventDescription: meta.description,
      enabled: row?.enabled ?? false,
      guildId: row?.guildId ?? "",
      channelId: row?.channelId ?? "",
      updatedAtMs:
        row?.updatedAt instanceof Date ? row.updatedAt.getTime() : null
    };
  });
}

export async function upsertBotNotificationSetting(input: {
  eventKey: BotNotificationEventKey;
  enabled: boolean;
  guildId?: string;
  channelId?: string;
}) {
  const guildId = input.guildId?.trim() ?? "";
  const channelId = input.channelId?.trim() ?? "";

  if (input.enabled && (!guildId || !channelId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Guild ID and Channel ID are required when event is enabled"
    });
  }

  await db
    .insert(botNotificationSettingsTable)
    .values({
      eventKey: input.eventKey,
      enabled: input.enabled,
      guildId: guildId || null,
      channelId: channelId || null,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: botNotificationSettingsTable.eventKey,
      set: {
        enabled: input.enabled,
        guildId: guildId || null,
        channelId: channelId || null,
        updatedAt: new Date()
      }
    });

  return {
    eventKey: input.eventKey,
    enabled: input.enabled,
    guildId,
    channelId
  };
}

export async function getBotGuilds() {
  const guilds = await db
    .select({
      id: botGuildsTable.guildId,
      name: botGuildsTable.guildName
    })
    .from(botGuildsTable)
    .orderBy(asc(botGuildsTable.guildName));

  return guilds;
}

export async function getBotChannels(guildId: string) {
  if (!guildId) {
    return [];
  }

  const channels = await db
    .select({
      id: botChannelsTable.channelId,
      name: botChannelsTable.channelName
    })
    .from(botChannelsTable)
    .where(eq(botChannelsTable.guildId, guildId))
    .orderBy(asc(botChannelsTable.channelName));

  return channels;
}
