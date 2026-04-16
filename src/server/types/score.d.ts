export type ScoreEligibleRun = {
  runId?: string;
  userId: string;
  questId: string;
  category?: string;
  runTimeMs: number;
  submittedAt: Date | string | number;
};

export type ScoreAggregate = {
  sum: number;
  count: number;
};

export type Top3Placements = {
  first: number;
  second: number;
  third: number;
};
