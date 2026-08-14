/**
 * Timezone-aware date helpers for medication schedules. The app has no
 * per-family timezone concept anywhere else (dates are naive strings,
 * display formatting is hardcoded to `pt-BR`) — this fixes a single
 * app-wide timezone for v1 rather than introducing a `families.timezone`
 * column/UI, consistent with that existing convention.
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

const ISO_WEEKDAY_BY_SHORT_NAME: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Today's calendar day in `APP_TIMEZONE`, as "YYYY-MM-DD". */
export function currentOccurrenceDate(now: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Today's ISO weekday (1=segunda..7=domingo) in `APP_TIMEZONE`. */
export function currentWeekday(now: number = Date.now()): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(now);
  const weekday = ISO_WEEKDAY_BY_SHORT_NAME[short];
  if (!weekday) {
    throw new Error(`Não foi possível resolver o dia da semana para "${short}".`);
  }
  return weekday;
}

/** How far `APP_TIMEZONE`'s wall clock is from UTC at `instant`, in minutes. */
function timezoneOffsetMinutes(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  return (wallClockAsUtc - instant) / 60_000;
}

/**
 * "YYYY-MM-DD" + N days -> "YYYY-MM-DD". Plain calendar-day arithmetic, no
 * timezone conversion involved (unlike `scheduledInstant` below) — used to
 * derive a treatment's `endDate` from its `startDate` + `durationDays`.
 */
export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves the epoch-ms instant for a wall-clock `occurrenceDate` +
 * `timeOfDay` in `APP_TIMEZONE`. Two-pass to be correct across a DST
 * transition, even though Brazil hasn't observed DST since 2019.
 */
export function scheduledInstant(occurrenceDate: string, timeOfDay: string): number {
  const [year, month, day] = occurrenceDate.split("-").map(Number);
  const [hour, minute] = timeOfDay.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  const firstPassOffset = timezoneOffsetMinutes(wallClockAsUtc);
  const instant = wallClockAsUtc - firstPassOffset * 60_000;

  const secondPassOffset = timezoneOffsetMinutes(instant);
  if (secondPassOffset === firstPassOffset) {
    return instant;
  }
  return wallClockAsUtc - secondPassOffset * 60_000;
}
