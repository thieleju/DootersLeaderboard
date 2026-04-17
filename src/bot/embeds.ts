import { EmbedBuilder } from "discord.js";

export function buildInfoEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(title)
    .setDescription(description);
}

export function buildErrorEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("Error")
    .setDescription(description);
}
