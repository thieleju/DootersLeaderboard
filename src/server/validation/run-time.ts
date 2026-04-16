export const RUN_TIME_INPUT_REGEX = /^(5[0]|[0-4]?\d)'([0-5]\d)"([0-9]{2})$/;

export function isValidRunTimeRange(runTime: string): boolean {
  const match = RUN_TIME_INPUT_REGEX.exec(runTime);
  if (!match) return false;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const centiseconds = Number(match[3]);

  if (minutes > 50) return false;
  if (minutes === 50 && (seconds > 0 || centiseconds > 0)) return false;

  if (minutes === 0 && seconds === 0 && centiseconds === 0) return false;

  return true;
}

export function maskRunTimeInput(input: string): string {
  const digitsOnly = input.replace(/[^0-9]/g, "");
  if (!digitsOnly) return "";

  const limited = digitsOnly.slice(0, 6).padEnd(6, "0");

  let minutes = Number(limited.slice(0, 2));
  let seconds = Number(limited.slice(2, 4));
  let centiseconds = Number(limited.slice(4, 6));

  if (minutes > 50) {
    minutes = 50;
    seconds = 0;
    centiseconds = 0;
  } else if (minutes === 50 && (seconds > 0 || centiseconds > 0)) {
    seconds = 0;
    centiseconds = 0;
  }

  if (seconds > 59) {
    seconds = 59;
  }

  if (minutes === 0 && seconds === 0 && centiseconds === 0) {
    seconds = 1;
  }

  const formatted = `${String(minutes).padStart(2, "0")}'${String(seconds).padStart(2, "0")}"${String(centiseconds).padStart(2, "0")}`;

  const len = digitsOnly.length;
  if (len <= 2) {
    return digitsOnly;
  } else if (len <= 4) {
    return `${digitsOnly.slice(0, 2)}'${digitsOnly.slice(2)}`;
  } else {
    return formatted;
  }
}
