import { type Guild } from "discord.js";

const categoryLabelById: Record<string, string> = {
  fs: "Freestyle",
  rr: "Restricted Rules",
  "ta-wiki": "TA Wiki",
  arena: "Arena Quest"
};

export function formatCategoryLabel(categoryId: string) {
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

export function formatWeaponsValue(
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

export function formatRunTime(totalMs: number): string {
  const clamped = Number.isFinite(totalMs) ? Math.max(0, totalMs) : 0;
  const totalCentiseconds = Math.floor(clamped / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${minutes.toString().padStart(2, "0")}'${seconds
    .toString()
    .padStart(2, "0")}"${centiseconds.toString().padStart(2, "0")}`;
}
