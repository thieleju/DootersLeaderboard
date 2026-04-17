import { ActivityType, type Client } from "discord.js";
import { and, isNull } from "drizzle-orm";

import { db } from "../server/db";
import { runs as runsTable } from "../server/db/schema";
import { getHomeStats } from "../server/lib/stats";

type PresenceSnapshot = {
  uploadedRunCount: number;
  activeRunnerCount: number;
  pendingRunCount: number;
};

async function getPresenceSnapshot(): Promise<PresenceSnapshot> {
  const [homeStats, pendingRuns] = await Promise.all([
    getHomeStats(),
    db
      .select({ id: runsTable.id })
      .from(runsTable)
      .where(
        and(
          isNull(runsTable.approvedByUserId),
          isNull(runsTable.rejectedByUserId)
        )
      )
  ]);

  return {
    uploadedRunCount: homeStats.uploadedRunCount,
    activeRunnerCount: homeStats.activeRunnerCount,
    pendingRunCount: pendingRuns.length
  };
}

function buildPresenceMessages(snapshot: PresenceSnapshot) {
  return [
    {
      type: ActivityType.Watching,
      name: `${snapshot.uploadedRunCount.toLocaleString("en-US")} approved runs`
    },
    {
      type: ActivityType.Playing,
      name: `with ${snapshot.activeRunnerCount.toLocaleString("en-US")} hunters`
    },
    snapshot.pendingRunCount > 0
      ? {
          type: ActivityType.Listening,
          name: `${snapshot.pendingRunCount.toLocaleString("en-US")} runs pending review`
        }
      : {
          type: ActivityType.Competing,
          name: "for the top score"
        }
  ] as const;
}

export async function updateBotPresence(client: Client) {
  if (!client.user) return;

  try {
    const snapshot = await getPresenceSnapshot();
    const messages = buildPresenceMessages(snapshot);
    const index = Math.floor(Date.now() / 60_000) % messages.length;
    const activity = messages[index] ?? messages[0];

    if (!activity) {
      return;
    }

    client.user.setPresence({
      status: "online",
      activities: [activity]
    });
  } catch (error) {
    console.error("[bot] Failed to update presence", error);
  }
}
