"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

interface BotNotificationSelectsProps {
  mode?: "guild" | "channel";
  guildId: string;
  channelId: string;
  onGuildChange: (guildId: string) => void;
  onChannelChange: (channelId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function BotNotificationSelects({
  mode = "guild",
  guildId,
  channelId,
  onGuildChange,
  onChannelChange,
  disabled = false,
  compact = false
}: BotNotificationSelectsProps) {
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const { data: guildsData, isLoading: guildsLoading } = (
    api.admin.listBotGuilds as any
  ).useQuery();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const { data: channelsData } = (api.admin.listBotChannels as any).useQuery(
    { guildId },
    { enabled: !!guildId }
  );

  useEffect(() => {
    if (guildsData && Array.isArray(guildsData)) {
      setGuilds(guildsData);
    }
  }, [guildsData]);

  useEffect(() => {
    if (channelsData && Array.isArray(channelsData)) {
      setChannels(channelsData);
    }
  }, [channelsData]);

  const selectClass = compact
    ? "rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
    : "rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

  const wrapperClass = compact ? "w-full" : "w-full";

  if (mode === "channel") {
    return (
      <div className={wrapperClass}>
        <select
          value={channelId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onChannelChange(e.target.value)
          }
          disabled={disabled || !guildId || channels.length === 0}
          className={selectClass}
        >
          <option value="">Channel</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <select
        value={guildId}
        onChange={(e) => {
          onGuildChange(e.target.value);
          onChannelChange("");
        }}
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        disabled={disabled || (guildsLoading ?? false)}
        className={selectClass}
      >
        <option value="">Guild</option>
        {guilds.map((guild) => (
          <option key={guild.id} value={guild.id}>
            {guild.name}
          </option>
        ))}
      </select>
    </div>
  );
}
