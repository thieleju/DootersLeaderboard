import { AttachmentBuilder, EmbedBuilder, type Client } from "discord.js";
import { eq, isNull } from "drizzle-orm";

import { db } from "../server/db";
import {
  botNotificationQueue,
  botNotificationSettings,
  quests,
  runs,
  users
} from "../server/db/schema";
import { createLogger } from "../server/lib/logger";
import {
  formatCategoryLabel,
  formatRunTime,
  formatWeaponsValue
} from "./formatting";
import type { BotNotificationSettingsRow } from "./types";

const logger = createLogger("bot.notifications");

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
  appBaseUrl: string,
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

export async function pollAndSendNotifications(
  client: Client,
  appBaseUrl: string
) {
  try {
    const pendingNotifications = await db
      .select()
      .from(botNotificationQueue)
      .where(isNull(botNotificationQueue.sentAt))
      .limit(10);

    for (const notification of pendingNotifications) {
      try {
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
        const eventPageUrl = buildEventPageUrl(
          appBaseUrl,
          notification.eventKey,
          {
            runId: notification.runId,
            questId: notification.questId,
            userId: notification.userId
          }
        );

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
                name: "Video",
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
              approvedByUserId: runs.approvedByUserId,
              screenshotBase64: runs.screenshotBase64
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
              userId: runs.userId,
              screenshotBase64: runs.screenshotBase64
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
            .setTitle("Quest Update")
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
            .setTitle("New User")
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

        const targetGuildId = settings.guildId;
        const targetChannelId = settings.channelId;
        const targetChannelName =
          "name" in channel ? String(channel.name) : "unknown";

        if (attachment) {
          await channel.send({ embeds: [embed], files: [attachment] });
        } else {
          await channel.send({ embeds: [embed] });
        }

        logger.info("notification sent", {
          eventKey: notification.eventKey,
          guildId: targetGuildId,
          channelId: targetChannelId,
          channelName: targetChannelName,
          queueId: notification.id,
          runId: notification.runId ?? null,
          userId: notification.userId ?? null
        });

        await db
          .update(botNotificationQueue)
          .set({ sentAt: new Date() })
          .where(eq(botNotificationQueue.id, notification.id));
      } catch (error) {
        logger.error("failed to process notification", {
          queueId: notification.id,
          eventKey: notification.eventKey,
          runId: notification.runId ?? null,
          userId: notification.userId ?? null,
          error
        });
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
    logger.error("notification polling failed", { error });
  }
}
