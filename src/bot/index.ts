import "dotenv/config";
import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  type Guild,
  type ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import { asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "../server/db";
import {
  botChannels,
  botGuilds,
  botNotificationQueue,
  botNotificationSettings,
  quests,
  runs,
  users
} from "../server/db/schema";
import {
  calculatePlacementScore,
  calculateUserScoreAndTop3Placements
} from "../server/lib/score";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  throw new Error("Missing DISCORD_BOT_TOKEN environment variable.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

type QuestOption = {
  id: string;
  title: string;
  monster: string;
  difficultyStars: number;
  approvedRunCount: number;
};

type BotNotificationSettingsRow = {
  eventKey: string;
  enabled: boolean;
  guildId: string | null;
  channelId: string | null;
};

const categoryLabelById: Record<string, string> = {
  fs: "Freestyle",
  rr: "Restricted Rules",
  "ta-wiki": "TA Wiki",
  arena: "Arena Quest"
};

function formatCategoryLabel(categoryId: string) {
  return categoryLabelById[categoryId] ?? categoryId;
}

function formatWeaponEmoji(guild: Guild, key: string) {
  const emoji = guild.emojis.cache.find((candidate) => candidate.name === key);
  if (!emoji) {
    return `:${key}:`;
  }

  const prefix = emoji.animated ? "a" : "";
  return `<${prefix}:${emoji.name}:${emoji.id}>`;
}

function formatWeaponsValue(
  guild: Guild,
  primaryWeapon: string,
  secondaryWeapon?: string | null
) {
  const primary = formatWeaponEmoji(guild, primaryWeapon);
  if (!secondaryWeapon) {
    return primary;
  }

  return `${primary} + ${formatWeaponEmoji(guild, secondaryWeapon)}`;
}

const appBaseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

function buildEventPagePath(
  eventKey: string,
  ids: {
    runId?: string | null;
    questId?: string | null;
    userId?: string | null;
  }
) {
  if (
    eventKey === "run_submitted" ||
    eventKey === "run_approved" ||
    eventKey === "run_rejected"
  ) {
    return "/runs";
  }

  if (eventKey === "quest_modified") {
    return "/quests";
  }

  if (eventKey === "user_first_login") {
    return ids.userId ? `/profile/${ids.userId}` : "/rankings";
  }

  return "/";
}

function buildEventPageUrl(
  eventKey: string,
  ids: {
    runId?: string | null;
    questId?: string | null;
    userId?: string | null;
  }
) {
  const path = buildEventPagePath(eventKey, ids);
  return appBaseUrl ? `${appBaseUrl}${path}` : path;
}

function buildScreenshotAttachment(base64Value: string) {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s.exec(
    base64Value
  );
  const mimeType = match?.[1] ?? "image/png";
  const rawBase64 = (match?.[2] ?? base64Value).replace(/\s+/g, "");

  if (!rawBase64) {
    return null;
  }

  const extension = mimeType.split("/")[1]?.toLowerCase() ?? "png";

  try {
    const buffer = Buffer.from(rawBase64, "base64");
    if (buffer.length === 0) {
      return null;
    }

    return new AttachmentBuilder(buffer, {
      name: `run-screenshot.${extension}`
    });
  } catch {
    return null;
  }
}

function parseNotificationData(dataJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(dataJson) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed payloads and continue with a safe empty object
  }

  return {};
}

function getStringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function buildInfoEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(title)
    .setDescription(description);
}

function buildErrorEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("Error")
    .setDescription(description);
}

function truncateChoiceName(value: string) {
  return value.length <= 100 ? value : `${value.slice(0, 97)}...`;
}

function questChoiceName(quest: QuestOption) {
  return truncateChoiceName(
    `${quest.title} · ${quest.difficultyStars}★ ${quest.monster} (${quest.approvedRunCount})`
  );
}

async function pollAndSendNotifications() {
  try {
    // Get pending notifications
    const pendingNotifications = await db
      .select()
      .from(botNotificationQueue)
      .where(isNull(botNotificationQueue.sentAt))
      .limit(10);

    for (const notification of pendingNotifications) {
      try {
        // Get notification settings for this event
        const settings = await db
          .select()
          .from(botNotificationSettings)
          .where(eq(botNotificationSettings.eventKey, notification.eventKey))
          .limit(1)
          .then(
            (rows) =>
              (rows[0] as BotNotificationSettingsRow | undefined) ?? null
          );

        if (
          !settings ||
          !settings.enabled ||
          !settings.guildId ||
          !settings.channelId
        ) {
          // Mark as sent if settings don't allow sending
          await db
            .update(botNotificationQueue)
            .set({ sentAt: new Date() })
            .where(eq(botNotificationQueue.id, notification.id));
          continue;
        }

        const guild = client.guilds.cache.get(settings.guildId);
        if (!guild) {
          await db
            .update(botNotificationQueue)
            .set({
              lastError: "Guild not found in bot cache",
              failedCount: (notification.failedCount ?? 0) + 1
            })
            .where(eq(botNotificationQueue.id, notification.id));
          continue;
        }

        const channel = guild.channels.cache.get(settings.channelId);
        if (!channel?.isTextBased()) {
          await db
            .update(botNotificationQueue)
            .set({
              lastError: "Channel not found or not a text channel",
              failedCount: (notification.failedCount ?? 0) + 1
            })
            .where(eq(botNotificationQueue.id, notification.id));
          continue;
        }

        const notificationData = parseNotificationData(notification.dataJson);
        const eventPageUrl = buildEventPageUrl(notification.eventKey, {
          runId: notification.runId,
          questId: notification.questId,
          userId: notification.userId
        });

        // Build embed based on event type
        let embed: EmbedBuilder | null = null;
        let attachment: AttachmentBuilder | null = null;

        if (notification.eventKey === "run_submitted" && notification.runId) {
          const run = await db
            .select({
              hunterName: runs.hunterName,
              runTimeMs: runs.runTimeMs,
              category: runs.category,
              youtubeLink: runs.youtubeLink,
              screenshotBase64: runs.screenshotBase64,
              primaryWeapon: runs.primaryWeapon,
              secondaryWeapon: runs.secondaryWeapon,
              questId: runs.questId,
              userId: runs.userId
            })
            .from(runs)
            .where(eq(runs.id, notification.runId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          const quest = run
            ? await db
                .select({
                  title: quests.title,
                  monster: quests.monster,
                  difficultyStars: quests.difficultyStars
                })
                .from(quests)
                .where(eq(quests.id, run.questId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          const user = run
            ? await db
                .select({ displayName: users.displayName, name: users.name })
                .from(users)
                .where(eq(users.id, run.userId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          if (run && quest && user) {
            const timeStr = formatRunTime(run.runTimeMs);

            const userName = user.displayName ?? user.name ?? "Unknown Runner";

            embed = new EmbedBuilder()
              .setColor(0x3b82f6)
              .setTitle("New Run Submitted")
              .setDescription(`**${userName}** submitted a new run!`)
              .addFields(
                {
                  name: "Quest",
                  value: `${quest.title} (${quest.difficultyStars}★ ${quest.monster})`,
                  inline: false
                },
                {
                  name: "Category",
                  value: formatCategoryLabel(run.category),
                  inline: false
                },
                {
                  name: "Weapons",
                  value: formatWeaponsValue(
                    guild,
                    run.primaryWeapon,
                    run.secondaryWeapon
                  ),
                  inline: false
                },
                { name: "Time", value: timeStr, inline: false },
                {
                  name: "Open in Dooters Leaderboard",
                  value: `[Link](${eventPageUrl})`,
                  inline: false
                }
              );

            if (run.youtubeLink) {
              embed.addFields({
                name: "YouTube",
                value: `[Watch Here](${run.youtubeLink})`,
                inline: false
              });
            }

            if (run.screenshotBase64) {
              attachment = buildScreenshotAttachment(run.screenshotBase64);

              if (attachment) {
                const attachmentName = attachment.name ?? "run-screenshot.png";
                embed.setImage(`attachment://${attachmentName}`);
              } else {
                embed.addFields({
                  name: "Screenshot",
                  value: "Provided, but could not be attached",
                  inline: false
                });
              }
            }
          }
        } else if (
          notification.eventKey === "run_approved" &&
          notification.runId
        ) {
          const run = await db
            .select({
              hunterName: runs.hunterName,
              runTimeMs: runs.runTimeMs,
              category: runs.category,
              primaryWeapon: runs.primaryWeapon,
              secondaryWeapon: runs.secondaryWeapon,
              questId: runs.questId,
              userId: runs.userId,
              approvedByUserId: runs.approvedByUserId
            })
            .from(runs)
            .where(eq(runs.id, notification.runId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          const quest = run
            ? await db
                .select({
                  title: quests.title,
                  monster: quests.monster,
                  difficultyStars: quests.difficultyStars
                })
                .from(quests)
                .where(eq(quests.id, run.questId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          const user = run
            ? await db
                .select({ displayName: users.displayName, name: users.name })
                .from(users)
                .where(eq(users.id, run.userId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          if (run && quest && user) {
            const timeStr = formatRunTime(run.runTimeMs);
            const userName = user.displayName ?? user.name ?? "Unknown Runner";

            embed = new EmbedBuilder()
              .setColor(0x22c55e)
              .setTitle("✅ Run Approved")
              .setDescription(`**${userName}** had a run approved!`)
              .addFields(
                {
                  name: "Quest",
                  value: `${quest.title} (${quest.difficultyStars}★ ${quest.monster})`,
                  inline: false
                },
                {
                  name: "Weapons",
                  value: formatWeaponsValue(
                    guild,
                    run.primaryWeapon,
                    run.secondaryWeapon
                  ),
                  inline: false
                },
                { name: "Time", value: timeStr, inline: false },
                {
                  name: "Open in Dooters Leaderboard",
                  value: `[Link](${eventPageUrl})`,
                  inline: false
                }
              );
          }
        } else if (
          notification.eventKey === "run_rejected" &&
          notification.runId
        ) {
          const run = await db
            .select({
              hunterName: runs.hunterName,
              runTimeMs: runs.runTimeMs,
              category: runs.category,
              primaryWeapon: runs.primaryWeapon,
              secondaryWeapon: runs.secondaryWeapon,
              questId: runs.questId,
              userId: runs.userId
            })
            .from(runs)
            .where(eq(runs.id, notification.runId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          const quest = run
            ? await db
                .select({
                  title: quests.title,
                  monster: quests.monster,
                  difficultyStars: quests.difficultyStars
                })
                .from(quests)
                .where(eq(quests.id, run.questId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          const user = run
            ? await db
                .select({ displayName: users.displayName, name: users.name })
                .from(users)
                .where(eq(users.id, run.userId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          if (run && quest && user) {
            const timeStr = formatRunTime(run.runTimeMs);
            const userName = user.displayName ?? user.name ?? "Unknown Runner";

            embed = new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle("❌ Run Rejected")
              .setDescription(`A run from **${userName}** was rejected.`)
              .addFields(
                {
                  name: "Quest",
                  value: `${quest.title} (${quest.difficultyStars}★ ${quest.monster})`,
                  inline: false
                },
                {
                  name: "Weapons",
                  value: formatWeaponsValue(
                    guild,
                    run.primaryWeapon,
                    run.secondaryWeapon
                  ),
                  inline: false
                },
                { name: "Time", value: timeStr, inline: false },
                {
                  name: "Open in Dooters Leaderboard",
                  value: `[Link](${eventPageUrl})`,
                  inline: false
                }
              );
          }
        } else if (notification.eventKey === "quest_modified") {
          const action =
            getStringFromRecord(notificationData, "action") ?? "updated";

          const payloadTitle = getStringFromRecord(notificationData, "title");
          const payloadMonster = getStringFromRecord(
            notificationData,
            "monster"
          );
          const payloadDifficulty = notificationData.difficultyStars;
          const difficultyStars =
            typeof payloadDifficulty === "number"
              ? payloadDifficulty
              : typeof payloadDifficulty === "string"
                ? Number(payloadDifficulty)
                : null;

          const quest =
            notification.questId && action !== "deleted"
              ? await db
                  .select({
                    title: quests.title,
                    monster: quests.monster,
                    difficultyStars: quests.difficultyStars
                  })
                  .from(quests)
                  .where(eq(quests.id, notification.questId))
                  .limit(1)
                  .then((rows) => rows[0] ?? null)
              : null;

          const title = quest?.title ?? payloadTitle ?? "Unknown Quest";
          const monster = quest?.monster ?? payloadMonster ?? "Unknown Monster";
          const stars = quest?.difficultyStars ?? difficultyStars;

          const actionLabelByKey: Record<string, string> = {
            created: "created",
            updated: "updated",
            deleted: "deleted"
          };

          const actionLabel = actionLabelByKey[action] ?? "updated";

          embed = new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setTitle("Quest Modified")
            .setDescription(`A quest was ${actionLabel}.`)
            .addFields(
              {
                name: "Quest",
                value: `${title} (${monster})`,
                inline: false
              },
              {
                name: "Action",
                value:
                  actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1),
                inline: false
              },
              {
                name: "Difficulty",
                value:
                  typeof stars === "number" && Number.isFinite(stars)
                    ? `${stars}★`
                    : "Unknown",
                inline: false
              },
              {
                name: "Open in Dooters Leaderboard",
                value: `[Link](${eventPageUrl})`,
                inline: false
              }
            );
        } else if (notification.eventKey === "user_first_login") {
          const userId = notification.userId;
          const user = userId
            ? await db
                .select({ displayName: users.displayName, name: users.name })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : null;

          const fallbackUserName =
            getStringFromRecord(notificationData, "displayName") ??
            getStringFromRecord(notificationData, "name") ??
            "A new user";

          const userName = user?.displayName ?? user?.name ?? fallbackUserName;

          embed = new EmbedBuilder()
            .setColor(0x14b8a6)
            .setTitle("👋 New Hunter Joined")
            .setDescription(`**${userName}** logged in for the first time.`)
            .addFields({
              name: "Open in Dooters Leaderboard",
              value: `[Link](${eventPageUrl})`,
              inline: false
            });
        }

        embed ??= new EmbedBuilder()
          .setColor(0x64748b)
          .setTitle("🔔 Notification Event")
          .setDescription(`Event: **${notification.eventKey}**`)
          .addFields({
            name: "Open in Dooters Leaderboard",
            value: `[Link](${eventPageUrl})`,
            inline: false
          });

        if (embed) {
          const targetGuildId = settings.guildId;
          const targetChannelId = settings.channelId;
          const targetChannelName =
            "name" in channel ? String(channel.name) : "unknown";

          if (attachment) {
            await channel.send({ embeds: [embed], files: [attachment] });
          } else {
            await channel.send({ embeds: [embed] });
          }

          console.log(
            `[bot] Sent ${notification.eventKey} to guild=${targetGuildId} channel=${targetChannelId} (${targetChannelName})`
          );

          await db
            .update(botNotificationQueue)
            .set({ sentAt: new Date() })
            .where(eq(botNotificationQueue.id, notification.id));
        }
      } catch (error) {
        console.error("[bot] Failed to process notification", error);
        await db
          .update(botNotificationQueue)
          .set({
            lastError: error instanceof Error ? error.message : "Unknown error",
            failedCount: (notification.failedCount ?? 0) + 1
          })
          .where(eq(botNotificationQueue.id, notification.id));
      }
    }
  } catch (error) {
    console.error("[bot] Notification polling failed", error);
  }
}

async function getQuestOptionsWithApprovedRuns(): Promise<QuestOption[]> {
  const rows = await db
    .select({
      id: quests.id,
      title: quests.title,
      monster: quests.monster,
      difficultyStars: quests.difficultyStars,
      approvedRunCount: sql<number>`count(${runs.id})`
    })
    .from(runs)
    .innerJoin(quests, eq(runs.questId, quests.id))
    .where(isNotNull(runs.approvedByUserId))
    .groupBy(quests.id, quests.title, quests.monster, quests.difficultyStars)
    .orderBy(
      desc(sql<number>`count(${runs.id})`),
      desc(quests.difficultyStars),
      asc(quests.title)
    );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    monster: row.monster,
    difficultyStars: row.difficultyStars,
    approvedRunCount: Number(row.approvedRunCount)
  }));
}

async function registerCommands() {
  const questOptions = await getQuestOptionsWithApprovedRuns();
  const questChoices = questOptions.slice(0, 25).map((quest) => ({
    name: questChoiceName(quest),
    value: quest.id
  }));

  const leaderboardCommand = new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Shows quest leaderboard or global rankings")
    .addStringOption((option) => {
      const configured = option
        .setName("quest")
        .setDescription("Optional: quest with at least one approved run")
        .setRequired(false);

      if (questChoices.length > 0) {
        configured.addChoices(...questChoices);
      }

      return configured;
    })
    .toJSON();

  return [leaderboardCommand] as const;
}

async function registerCommandsForGuild(guild: Guild) {
  const commands = await registerCommands();
  await guild.commands.set(commands);
  console.log(`[bot] Registered slash commands for guild ${guild.id}`);
}

async function registerCommandsForAllGuilds() {
  const guildCollection = await client.guilds.fetch();

  for (const fetchedGuild of guildCollection.values()) {
    const guild = await fetchedGuild.fetch();
    await registerCommandsForGuild(guild);
  }
}

async function syncGuildsAndChannels() {
  try {
    const guildCollection = await client.guilds.fetch();
    const guildIds = new Set<string>();

    for (const fetchedGuild of guildCollection.values()) {
      const guild = await fetchedGuild.fetch();
      guildIds.add(guild.id);

      // Upsert guild
      await db
        .insert(botGuilds)
        .values({
          guildId: guild.id,
          guildName: guild.name,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: botGuilds.guildId,
          set: {
            guildName: guild.name,
            updatedAt: new Date()
          }
        });

      // Fetch and sync channels
      const channels = await guild.channels.fetch();
      const channelIds = new Set<string>();

      for (const fetchedChannel of channels.values()) {
        if (!fetchedChannel?.isTextBased()) continue;

        channelIds.add(fetchedChannel.id);

        await db
          .insert(botChannels)
          .values({
            channelId: fetchedChannel.id,
            guildId: guild.id,
            channelName: fetchedChannel.name,
            isText: true,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: botChannels.channelId,
            set: {
              channelName: fetchedChannel.name,
              updatedAt: new Date()
            }
          });
      }

      // Delete channels that no longer exist
      if (channelIds.size > 0) {
        await db.delete(botChannels).where(eq(botChannels.guildId, guild.id));

        // Re-insert the ones that still exist
        for (const channelId of channelIds) {
          const channel = await guild.channels
            .fetch(channelId)
            .catch(() => null);
          if (channel?.isTextBased()) {
            await db
              .insert(botChannels)
              .values({
                channelId: channel.id,
                guildId: guild.id,
                channelName: channel.name,
                isText: true,
                updatedAt: new Date()
              })
              .onConflictDoUpdate({
                target: botChannels.channelId,
                set: {
                  channelName: channel.name,
                  updatedAt: new Date()
                }
              });
          }
        }
      }
    }

    console.log("[bot] Successfully synced guilds and channels");
  } catch (error) {
    console.error("[bot] Failed to sync guilds and channels", error);
  }
}

function formatRunTime(totalMs: number): string {
  const clamped = Number.isFinite(totalMs) ? Math.max(0, totalMs) : 0;
  const totalCentiseconds = Math.floor(clamped / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${minutes.toString().padStart(2, "0")}'${seconds
    .toString()
    .padStart(2, "0")}\"${centiseconds.toString().padStart(2, "0")}`;
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  const questId = interaction.options.getString("quest");

  if (!questId) {
    await handleRankings(interaction);
    return;
  }

  const questOptions = await getQuestOptionsWithApprovedRuns();
  const selectedQuest = questOptions.find((quest) => quest.id === questId);

  if (!selectedQuest) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed(
          "Selected quest is invalid or has no approved runs anymore."
        )
      ],
      ephemeral: true
    });
    return;
  }

  const approvedRuns = await db
    .select({
      runId: runs.id,
      hunterName: runs.hunterName,
      runTimeMs: runs.runTimeMs,
      category: runs.category
    })
    .from(runs)
    .where(
      sql`${isNotNull(runs.approvedByUserId)} and ${eq(runs.questId, questId)}`
    )
    .orderBy(asc(runs.runTimeMs), asc(runs.submittedAt));

  if (approvedRuns.length === 0) {
    await interaction.reply({
      embeds: [buildInfoEmbed("Leaderboard", "No approved runs found yet.")]
    });
    return;
  }

  const shownRuns = approvedRuns.slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = shownRuns.map((run, index) => {
    const rank = medals[index] ?? `${index + 1}.`;
    const placementScore = calculatePlacementScore(
      index + 1,
      approvedRuns.length
    );
    return `${rank} **${run.hunterName}** · ${formatRunTime(run.runTimeMs)} · ${formatCategoryLabel(run.category)} · ${placementScore.toLocaleString("en-US")} score`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`Leaderboard · ${selectedQuest.title}`)
    .setDescription(lines.join("\n"))
    .addFields(
      {
        name: "Monster",
        value: selectedQuest.monster,
        inline: false
      },
      {
        name: "Difficulty",
        value: `${selectedQuest.difficultyStars}★`,
        inline: false
      },
      {
        name: "Approved Runs",
        value: String(selectedQuest.approvedRunCount),
        inline: false
      }
    );

  await interaction.reply({
    embeds: [embed]
  });
}

async function handleRankings(interaction: ChatInputCommandInteraction) {
  const approvedRuns = await db
    .select({
      userId: runs.userId,
      questId: runs.questId,
      category: runs.category,
      runTimeMs: runs.runTimeMs,
      submittedAt: runs.submittedAt
    })
    .from(runs)
    .where(isNotNull(runs.approvedByUserId));

  if (approvedRuns.length === 0) {
    await interaction.reply({
      embeds: [buildInfoEmbed("Rankings", "No approved runs found yet.")]
    });
    return;
  }

  const { scoreByUser, top3PlacementsByUser } =
    calculateUserScoreAndTop3Placements(approvedRuns);

  const userIds = [...scoreByUser.keys()];
  const userRows =
    userIds.length > 0
      ? await db
          .select({
            id: users.id,
            displayName: users.displayName,
            name: users.name
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];

  const userNameById = new Map(
    userRows.map((user) => [
      user.id,
      user.displayName ?? user.name ?? "Unknown Runner"
    ])
  );

  const approvedRunsByUser = new Map<string, number>();
  for (const run of approvedRuns) {
    approvedRunsByUser.set(
      run.userId,
      (approvedRunsByUser.get(run.userId) ?? 0) + 1
    );
  }

  const rankingRows = [...scoreByUser.entries()]
    .map(([userId, score]) => {
      const placements = top3PlacementsByUser.get(userId) ?? {
        first: 0,
        second: 0,
        third: 0
      };

      return {
        userId,
        userName: userNameById.get(userId) ?? "Unknown Runner",
        score: score.sum,
        approvedRuns: approvedRunsByUser.get(userId) ?? 0,
        top3Total: placements.first + placements.second + placements.third
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.top3Total - a.top3Total ||
        a.userName.localeCompare(b.userName)
    )
    .slice(0, 10);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = rankingRows.map((row, index) => {
    const rank = medals[index] ?? `${index + 1}.`;
    return `${rank} **${row.userName}** · ${row.score.toLocaleString("en-US")} score · ${row.approvedRuns} runs`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("Global Rankings")
    .setDescription(lines.join("\n"));

  await interaction.reply({ embeds: [embed] });
}

client.once("clientReady", () => {
  const tag = client.user?.tag ?? "unknown";
  console.log(`[bot] Logged in as ${tag}`);

  void (async () => {
    try {
      await registerCommandsForAllGuilds();
      await syncGuildsAndChannels();
    } catch (error) {
      console.error("[bot] Failed to register commands", error);
    }
  })();

  // Start notification polling
  setInterval(() => {
    void pollAndSendNotifications();
  }, 5000); // Poll every 5 seconds

  // Sync guilds/channels every minute
  setInterval(() => {
    void syncGuildsAndChannels();
  }, 60000);
});

client.on("guildCreate", (guild) => {
  void (async () => {
    try {
      await registerCommandsForGuild(guild);
      await syncGuildsAndChannels();
    } catch (error) {
      console.error("[bot] Failed to register commands for new guild", error);
    }
  })();
});

client.on("guildDelete", () => {
  void syncGuildsAndChannels();
});

client.on("interactionCreate", (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  void (async () => {
    try {
      if (interaction.commandName === "leaderboard") {
        await handleLeaderboard(interaction);
        return;
      }
    } catch (error) {
      console.error("[bot] Command failed", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [buildErrorEmbed("Command failed. Please check bot logs.")],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          embeds: [buildErrorEmbed("Command failed. Please check bot logs.")],
          ephemeral: true
        });
      }
    }
  })();
});

void client.login(token);
