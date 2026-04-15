export const MAX_PLACEMENT_SCORE = 1000;
import type {
  ScoreAggregate,
  ScoreEligibleRun,
  Top3Placements
} from "~/server/types/score";

function toTimestamp(value: Date | string | number) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

export function calculatePlacementScore(rank: number, participants: number) {
  if (participants <= 0) return 0;

  const boundedRank = Math.min(Math.max(rank, 1), participants);
  return Math.ceil(
    (MAX_PLACEMENT_SCORE * (participants - boundedRank + 1)) / participants
  );
}

export function calculateUserScoreAndTop3Placements<T extends ScoreEligibleRun>(
  runs: T[]
) {
  const bestRunByQuestAndUser = new Map<string, T>();

  for (const run of runs) {
    const key = `${run.questId}:${run.userId}`;
    const existing = bestRunByQuestAndUser.get(key);

    if (!existing) {
      bestRunByQuestAndUser.set(key, run);
      continue;
    }

    const existingSubmittedAt = toTimestamp(existing.submittedAt);
    const runSubmittedAt = toTimestamp(run.submittedAt);

    if (
      run.runTimeMs < existing.runTimeMs ||
      (run.runTimeMs === existing.runTimeMs &&
        runSubmittedAt < existingSubmittedAt)
    ) {
      bestRunByQuestAndUser.set(key, run);
    }
  }

  const bestRunsByQuest = new Map<string, T[]>();
  for (const run of bestRunByQuestAndUser.values()) {
    const current = bestRunsByQuest.get(run.questId) ?? [];
    current.push(run);
    bestRunsByQuest.set(run.questId, current);
  }

  const top3PlacementsByUser = new Map<string, Top3Placements>();
  const scoreByUser = new Map<string, ScoreAggregate>();

  for (const questRuns of bestRunsByQuest.values()) {
    const sorted = questRuns
      .slice()
      .sort(
        (a, b) =>
          a.runTimeMs - b.runTimeMs ||
          toTimestamp(a.submittedAt) - toTimestamp(b.submittedAt)
      );

    const participants = sorted.length;
    sorted.forEach((run, index) => {
      const rank = index + 1;
      const score = calculatePlacementScore(rank, participants);
      const scoreCurrent = scoreByUser.get(run.userId) ?? { sum: 0, count: 0 };
      scoreCurrent.sum += score;
      scoreCurrent.count += 1;
      scoreByUser.set(run.userId, scoreCurrent);

      if (index > 2) return;
      const placementsCurrent = top3PlacementsByUser.get(run.userId) ?? {
        first: 0,
        second: 0,
        third: 0
      };
      if (index === 0) placementsCurrent.first += 1;
      if (index === 1) placementsCurrent.second += 1;
      if (index === 2) placementsCurrent.third += 1;
      top3PlacementsByUser.set(run.userId, placementsCurrent);
    });
  }

  return {
    scoreByUser,
    top3PlacementsByUser
  };
}
