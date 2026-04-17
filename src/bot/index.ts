import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

import { buildErrorEmbed } from "./embeds";
import {
  handleLeaderboard,
  registerCommandsForAllGuilds,
  registerCommandsForGuild
} from "./commands";
import { pollAndSendNotifications } from "./notifications";
import { updateBotPresence } from "./presence";
import { syncGuildsAndChannels } from "./sync";

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
  console.log(`[bot] Logged in as ${tag}`);

  void (async () => {
    try {
      await registerCommandsForAllGuilds(client);
      await syncGuildsAndChannels(client);
      await updateBotPresence(client);
    } catch (error) {
      console.error("[bot] Failed to register commands", error);
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
      console.error("[bot] Failed to register commands for new guild", error);
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
        await handleLeaderboard(interaction);
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
