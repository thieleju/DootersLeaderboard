export type ScoreEligibleRun = {
  userId: string;
  questId: string;
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
