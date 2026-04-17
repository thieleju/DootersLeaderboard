import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type Guild
} from "discord.js";
import { asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "../server/db";
import { quests, runs, users } from "../server/db/schema";
import {
  calculatePlacementScore,
  calculateUserScoreAndTop3Placements
} from "../server/lib/score";
import { buildErrorEmbed, buildInfoEmbed } from "./embeds";
import { formatCategoryLabel, formatRunTime } from "./formatting";
import type { QuestOption } from "./types";

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

export async function registerCommandsForGuild(guild: Guild) {
  const commands = await registerCommands();
  await guild.commands.set(commands);
  console.log(`[bot] Registered slash commands for guild ${guild.id}`);
}

export async function registerCommandsForAllGuilds(client: Client) {
  const guildCollection = await client.guilds.fetch();

  for (const fetchedGuild of guildCollection.values()) {
    const guild = await fetchedGuild.fetch();
    await registerCommandsForGuild(guild);
  }
}

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction
) {
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

export async function handleRankings(interaction: ChatInputCommandInteraction) {
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
