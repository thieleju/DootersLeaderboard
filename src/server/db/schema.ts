import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";
import type { BotNotificationEventKey } from "~/constants";

import type { QuestType, RunCategoryId, UserRole } from "../types/leaderboard";

export const createTable = sqliteTableCreator(
  (name) => `dootersleaderboard_${name}`
);

export const users = createTable("user", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.text({ length: 255 }),
  displayName: d.text({ length: 255 }),
  email: d.text({ length: 255 }),
  emailVerified: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
  image: d.text({ length: 255 }),
  lastLoginAt: d.integer({ mode: "timestamp" }),
  lastSeenAt: d.integer({ mode: "timestamp" }),
  role: d.text({ length: 32 }).$type<UserRole>().notNull().default("runner")
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts)
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.text({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.text({ length: 255 }).notNull(),
    providerAccountId: d.text({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.text({ length: 255 }),
    scope: d.text({ length: 255 }),
    id_token: d.text(),
    session_state: d.text({ length: 255 })
  }),
  (t) => [
    primaryKey({
      columns: [t.provider, t.providerAccountId]
    }),
    index("account_user_id_idx").on(t.userId)
  ]
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.text({ length: 255 }).notNull().primaryKey(),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.integer({ mode: "timestamp" }).notNull()
  }),
  (t) => [index("session_userId_idx").on(t.userId)]
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.text({ length: 255 }).notNull(),
    token: d.text({ length: 255 }).notNull(),
    expires: d.integer({ mode: "timestamp" }).notNull()
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const quests = createTable("quest", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: d.text({ length: 255 }).notNull(),
  monster: d.text({ length: 255 }).notNull(),
  type: d.text({ length: 32 }).$type<QuestType>().notNull(),
  area: d.text({ length: 255 }).notNull(),
  difficultyStars: d.integer().notNull()
}));

export const runs = createTable(
  "run",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    questId: d
      .text({ length: 255 })
      .notNull()
      .references(() => quests.id),
    hunterName: d.text({ length: 255 }).notNull(),
    submittedAt: d.integer({ mode: "timestamp" }).notNull(),
    runTimeMs: d.integer().notNull(),
    category: d.text({ length: 64 }).$type<RunCategoryId>().notNull(),
    tags: d.text({ length: 4000 }).notNull().default("null"),
    youtubeLink: d.text({ length: 2048 }),
    screenshotBase64: d.text({ length: 2_100_000 }),
    primaryWeapon: d.text({ length: 255 }).notNull(),
    secondaryWeapon: d.text({ length: 255 }),
    approvedByUserId: d.text({ length: 255 }).references(() => users.id),
    approvedAt: d.integer({ mode: "timestamp" }),
    rejectedByUserId: d.text({ length: 255 }).references(() => users.id),
    rejectedAt: d.integer({ mode: "timestamp" })
  }),
  (t) => [
    index("run_user_id_idx").on(t.userId),
    index("run_quest_id_idx").on(t.questId),
    index("run_approved_by_user_id_idx").on(t.approvedByUserId),
    index("run_rejected_by_user_id_idx").on(t.rejectedByUserId)
  ]
);

export const questsRelations = relations(quests, ({ many }) => ({
  runs: many(runs)
}));

export const runsRelations = relations(runs, ({ one }) => ({
  runner: one(users, { fields: [runs.userId], references: [users.id] }),
  quest: one(quests, { fields: [runs.questId], references: [quests.id] }),
  approvedBy: one(users, {
    fields: [runs.approvedByUserId],
    references: [users.id]
  }),
  rejectedBy: one(users, {
    fields: [runs.rejectedByUserId],
    references: [users.id]
  })
}));

export const botNotificationSettings = createTable(
  "bot_notification_settings",
  (d) => ({
    eventKey: d
      .text({ length: 64 })
      .$type<BotNotificationEventKey>()
      .notNull()
      .primaryKey(),
    enabled: d.integer({ mode: "boolean" }).notNull().default(false),
    guildId: d.text({ length: 64 }),
    channelId: d.text({ length: 64 }),
    updatedAt: d
      .integer({ mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
  })
);

export const botNotificationQueue = createTable(
  "bot_notification_queue",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventKey: d.text({ length: 64 }).$type<BotNotificationEventKey>().notNull(),
    runId: d.text({ length: 255 }).references(() => runs.id),
    questId: d.text({ length: 255 }).references(() => quests.id),
    userId: d.text({ length: 255 }).references(() => users.id),
    dataJson: d.text({ length: 50000 }).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    sentAt: d.integer({ mode: "timestamp" }),
    failedCount: d.integer().notNull().default(0),
    lastError: d.text()
  }),
  (t) => [
    index("bot_notification_queue_event_key_idx").on(t.eventKey),
    index("bot_notification_queue_sent_at_idx").on(t.sentAt),
    index("bot_notification_queue_run_id_idx").on(t.runId)
  ]
);

export const botGuilds = createTable("bot_guild", (d) => ({
  guildId: d.text({ length: 64 }).notNull().primaryKey(),
  guildName: d.text({ length: 255 }).notNull(),
  updatedAt: d
    .integer({ mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
}));

export const botChannels = createTable(
  "bot_channel",
  (d) => ({
    channelId: d.text({ length: 64 }).notNull().primaryKey(),
    guildId: d
      .text({ length: 64 })
      .notNull()
      .references(() => botGuilds.guildId),
    channelName: d.text({ length: 255 }).notNull(),
    isText: d.integer({ mode: "boolean" }).notNull().default(true),
    updatedAt: d
      .integer({ mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
  }),
  (t) => [
    index("bot_channel_guild_id_idx").on(t.guildId),
    index("bot_channel_is_text_idx").on(t.isText)
  ]
);
