import { type Client } from "discord.js";
import { eq } from "drizzle-orm";

import { db } from "../server/db";
import { botChannels, botGuilds } from "../server/db/schema";
import { createLogger } from "../server/lib/logger";

const logger = createLogger("bot.sync");

export async function syncGuildsAndChannels(client: Client) {
  try {
    const guildCollection = await client.guilds.fetch();
    let guildCount = 0;
    let textChannelCount = 0;

    for (const fetchedGuild of guildCollection.values()) {
      guildCount += 1;
      const guild = await fetchedGuild.fetch();

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

      const channels = await guild.channels.fetch();
      const channelIds = new Set<string>();

      for (const fetchedChannel of channels.values()) {
        if (!fetchedChannel?.isTextBased()) continue;

        channelIds.add(fetchedChannel.id);
        textChannelCount += 1;

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

      if (channelIds.size > 0) {
        await db.delete(botChannels).where(eq(botChannels.guildId, guild.id));

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

    logger.debug("guild and channel sync completed", {
      guildCount,
      textChannelCount
    });
  } catch (error) {
    logger.error("guild and channel sync failed", { error });
  }
}
