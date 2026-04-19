import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

import { buildErrorEmbed } from "./embeds";
import { createLogger } from "../server/lib/logger";
import {
  handleLeaderboard,
  registerCommandsForAllGuilds,
  registerCommandsForGuild
} from "./commands";
import { pollAndSendNotifications } from "./notifications";
import { updateBotPresence } from "./presence";
import { syncGuildsAndChannels } from "./sync";

const logger = createLogger("bot");

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  throw new Error("Missing DISCORD_BOT_TOKEN environment variable.");
}

const appBaseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
const notificationPollIntervalMs = 5000;
const guildSyncIntervalMs = 60000;
const presenceUpdateIntervalMs = 5 * 60_000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", () => {
  const tag = client.user?.tag ?? "unknown";
  logger.info("discord client ready", {
    botTag: tag
  });

  void (async () => {
    try {
      await registerCommandsForAllGuilds(client);
      await syncGuildsAndChannels(client);
      await updateBotPresence(client);
    } catch (error) {
      logger.error("startup bootstrap failed", { error });
    }
  })();

  setInterval(() => {
    void pollAndSendNotifications(client, appBaseUrl);
  }, notificationPollIntervalMs);

  setInterval(() => {
    void syncGuildsAndChannels(client);
  }, guildSyncIntervalMs);

  setInterval(() => {
    void updateBotPresence(client);
  }, presenceUpdateIntervalMs);
});

client.on("guildCreate", (guild) => {
  void (async () => {
    try {
      await registerCommandsForGuild(guild);
      await syncGuildsAndChannels(client);
    } catch (error) {
      logger.error("failed to register commands for new guild", {
        guildId: guild.id,
        guildName: guild.name,
        error
      });
    }
  })();
});

client.on("guildDelete", () => {
  void syncGuildsAndChannels(client);
});

client.on("interactionCreate", (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  void (async () => {
    try {
      if (interaction.commandName === "leaderboard") {
        logger.info("command received", {
          command: interaction.commandName,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          username: interaction.user.username
        });
        await handleLeaderboard(interaction);
      }
    } catch (error) {
      logger.error("command execution failed", {
        command: interaction.commandName,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        username: interaction.user.username,
        error
      });

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
