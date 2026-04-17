/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing } from "lucide-react";

import { api } from "~/trpc/react";
import type { BotNotificationEventKey } from "~/constants";
import AnimatedCard from "./animated-card";
import DataTable, { DataTableLoadingState } from "./data-table";
import ToggleSwitch from "./toggle-switch";
import { formatFullDateTime } from "./helpers";
import { BotNotificationSelects } from "./bot-notification-selects";

type AdminBotNotificationsCardProps = {
  delay?: number;
};

type DraftByEvent = Record<
  string,
  { enabled: boolean; guildId: string; channelId: string }
>;

type SettingRow = {
  eventKey: BotNotificationEventKey;
  eventLabel: string;
  eventDescription: string;
  enabled: boolean;
  guildId: string | null;
  channelId: string | null;
  updatedAtMs: number | null;
};

export default function AdminBotNotificationsCard({
  delay = 0
}: AdminBotNotificationsCardProps) {
  const utils = api.useUtils();

  const settingsQuery = api.admin.listBotNotificationSettings.useQuery(
    undefined,
    { staleTime: Infinity }
  );

  const [drafts, setDrafts] = useState<DraftByEvent>({});
  const [savingEventKey, setSavingEventKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize drafts from query data
  useEffect(() => {
    if (!settingsQuery.data) return;
    const rows: SettingRow[] = settingsQuery.data;
    if (rows.length === 0) return;

    setDrafts((current) => {
      if (Object.keys(current).length > 0) return current;

      const initial: DraftByEvent = {};
      for (const row of rows) {
        initial[row.eventKey] = {
          enabled: row.enabled,
          guildId: row.guildId ?? "",
          channelId: row.channelId ?? ""
        };
      }

      return initial;
    });
  }, [settingsQuery.data]);

  const upsertMutation = api.admin.upsertBotNotificationSetting.useMutation({
    onSuccess: async () => {
      setSavingEventKey(null);
      setSaveError(null);
      await utils.admin.listBotNotificationSettings.invalidate();
    },
    onError: (error: unknown) => {
      setSavingEventKey(null);
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Could not save bot notification settings.";
      setSaveError(errorMsg ?? "Could not save bot notification settings.");
    }
  });

  const rows: SettingRow[] = settingsQuery.data ?? [];
  const hasRows = rows.length > 0;
  const isSaving = upsertMutation.isPending || savingEventKey !== null;

  function persistDraft(
    eventKey: BotNotificationEventKey,
    nextDraft: { enabled: boolean; guildId: string; channelId: string }
  ) {
    const guildId = nextDraft.guildId.trim();
    const channelId = nextDraft.channelId.trim();

    if (nextDraft.enabled && (!guildId || !channelId)) {
      setSavingEventKey(null);
      setSaveError(null);
      return;
    }

    setSavingEventKey(eventKey);
    setSaveError(null);

    upsertMutation.mutate({
      eventKey,
      enabled: nextDraft.enabled,
      guildId: guildId.length > 0 ? guildId : undefined,
      channelId: channelId.length > 0 ? channelId : undefined
    });
  }

  return (
    <AnimatedCard delay={delay} className="p-6 shadow-2xl shadow-black/20">
      <DataTable
        title="Bot Notifications"
        description="Configure which Discord server/channel should receive each event."
        icon={<BellRing className="h-6 w-6" />}
        iconColor="violet"
        columns={[
          { key: "event", label: "Event" },
          { key: "enabled", label: "Enabled", className: "text-center" },
          { key: "guild", label: "Guild" },
          { key: "channel", label: "Channel" },
          { key: "updated", label: "Updated", className: "text-center" }
        ]}
      >
        {settingsQuery.isLoading ? (
          <DataTableLoadingState
            columnCount={5}
            label="Loading bot notification settings..."
          />
        ) : hasRows ? (
          <motion.tbody
            key="admin-bot-notification-rows"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {rows.map((row, index) => {
              const draft = drafts[row.eventKey] ?? {
                enabled: row.enabled,
                guildId: row.guildId ?? "",
                channelId: row.channelId ?? ""
              };

              return (
                <motion.tr
                  key={row.eventKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="border-b border-gray-800/70 text-sm transition-colors hover:bg-white/5"
                >
                  <td className="px-3 py-4 align-middle">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {row.eventLabel}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.eventDescription}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-4 text-center align-middle">
                    <ToggleSwitch
                      disabled={isSaving}
                      checked={draft.enabled}
                      onChange={(enabled) => {
                        const nextDraft = {
                          ...draft,
                          enabled
                        };

                        setDrafts((current) => ({
                          ...current,
                          [row.eventKey]: {
                            ...nextDraft
                          }
                        }));

                        persistDraft(row.eventKey, nextDraft);
                      }}
                      label={draft.enabled ? "On" : "Off"}
                    />
                  </td>

                  <td className="px-3 py-4 align-middle">
                    <BotNotificationSelects
                      mode="guild"
                      guildId={draft.guildId}
                      channelId={draft.channelId}
                      disabled={isSaving}
                      onGuildChange={(guildId) => {
                        const nextDraft = {
                          ...draft,
                          guildId,
                          channelId: ""
                        };

                        setDrafts((current) => ({
                          ...current,
                          [row.eventKey]: {
                            ...nextDraft
                          }
                        }));

                        persistDraft(row.eventKey, nextDraft);
                      }}
                      onChannelChange={() => {
                        // Guild change clears channel; channel is selected in the next column.
                      }}
                      compact
                    />
                  </td>

                  <td className="px-3 py-4 align-middle">
                    <BotNotificationSelects
                      mode="channel"
                      guildId={draft.guildId}
                      channelId={draft.channelId}
                      disabled={isSaving}
                      onGuildChange={() => {
                        // Guild is selected in the previous column.
                      }}
                      onChannelChange={(channelId) => {
                        const nextDraft = {
                          ...draft,
                          channelId
                        };

                        setDrafts((current) => ({
                          ...current,
                          [row.eventKey]: {
                            ...nextDraft
                          }
                        }));

                        persistDraft(row.eventKey, nextDraft);
                      }}
                      compact
                    />
                  </td>

                  <td className="px-3 py-4 text-center align-middle">
                    <span className="text-xs text-gray-400">
                      {row.updatedAtMs
                        ? formatFullDateTime(row.updatedAtMs)
                        : "Never"}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        ) : null}
      </DataTable>

      {!settingsQuery.isLoading && !hasRows ? (
        <div className="rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
          No bot notification events configured.
        </div>
      ) : null}

      {saveError ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {saveError}
        </motion.div>
      ) : null}
    </AnimatedCard>
  );
}
