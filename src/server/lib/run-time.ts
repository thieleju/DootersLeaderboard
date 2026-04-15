export const RUN_TIME_INPUT_REGEX = /^([0-5]?\d):([0-5]\d)\.([0-9]{2})$/;

export function parseRunTimeInputToMs(runTime: string) {
  const match = runTime.match(RUN_TIME_INPUT_REGEX);
  if (!match) {
    throw new Error("Invalid run time format");
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const centiseconds = Number(match[3]);

  return minutes * 60_000 + seconds * 1_000 + centiseconds * 10;
}

export function formatRunTimeInputFromMs(runTimeMs: number) {
  const totalCentiseconds = Math.round(runTimeMs / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}.${String(centiseconds).padStart(2, "0")}`;
}

export function formatRunTime(runTimeMs: number) {
  const totalCentiseconds = Math.round(runTimeMs / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${String(minutes).padStart(2, "0")}'${String(seconds).padStart(
    2,
    "0",
  )}"${String(centiseconds).padStart(2, "0")}`;
}
