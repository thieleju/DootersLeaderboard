import "dotenv/config";
import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  type Guild,
  type ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import { asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "../server/db";
import { quests, runs, users } from "../server/db/schema";
import { calculateUserScoreAndTop3Placements } from "../server/lib/score";

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
    .setDescription("Shows the leaderboard for a selected quest")
    .addStringOption((option) => {
      const configured = option
        .setName("quest")
        .setDescription("Quest with at least one approved run")
        .setRequired(true);

      if (questChoices.length > 0) {
        configured.addChoices(...questChoices);
      }

      return configured;
    })
    .toJSON();

  const rankingsCommand = new SlashCommandBuilder()
    .setName("rankings")
    .setDescription("Shows the global player rankings")
    .toJSON();

  return [leaderboardCommand, rankingsCommand] as const;
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
  const questId = interaction.options.getString("quest", true);
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
    .orderBy(asc(runs.runTimeMs), asc(runs.submittedAt))
    .limit(10);

  if (approvedRuns.length === 0) {
    await interaction.reply({
      embeds: [buildInfoEmbed("Leaderboard", "No approved runs found yet.")]
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = approvedRuns.map((run, index) => {
    const rank = medals[index] ?? `${index + 1}.`;
    return `${rank} **${run.hunterName}** · ${formatRunTime(run.runTimeMs)} · ${run.category.toUpperCase()}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`Leaderboard · ${selectedQuest.title}`)
    .setDescription(lines.join("\n"))
    .addFields(
      {
        name: "Monster",
        value: selectedQuest.monster,
        inline: true
      },
      {
        name: "Difficulty",
        value: `${selectedQuest.difficultyStars}★`,
        inline: true
      },
      {
        name: "Approved Runs",
        value: String(selectedQuest.approvedRunCount),
        inline: true
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
    return `${rank} **${row.userName}** · ${row.score.toLocaleString("en-US")} pts · ${row.approvedRuns} runs`;
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
    } catch (error) {
      console.error("[bot] Failed to register commands", error);
    }
  })();
});

client.on("guildCreate", (guild) => {
  void (async () => {
    try {
      await registerCommandsForGuild(guild);
    } catch (error) {
      console.error("[bot] Failed to register commands for new guild", error);
    }
  })();
});

client.on("interactionCreate", (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  void (async () => {
    try {
      if (interaction.commandName === "leaderboard") {
        await handleLeaderboard(interaction);
        return;
      }

      if (interaction.commandName === "rankings") {
        await handleRankings(interaction);
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
