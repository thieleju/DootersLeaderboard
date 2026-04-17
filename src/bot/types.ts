export type QuestOption = {
  id: string;
  title: string;
  monster: string;
  difficultyStars: number;
  approvedRunCount: number;
};

export type BotNotificationSettingsRow = {
  eventKey: string;
  enabled: boolean;
  guildId: string | null;
  channelId: string | null;
};
