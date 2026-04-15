export type HomeStats = {
  activeRunnerCount: number;
  uploadedRunCount: number;
  mostPlayedWeapon: {
    key: string;
    label: string;
    count: number;
  } | null;
  topRunner: {
    userId: string;
    userName: string;
    userImage: string | null;
    score: number;
  } | null;
};
