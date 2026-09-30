/**
 * The control values the human-path request form collects: a local start date and time plus an end
 * date and time, kept as raw strings so this module is unit-testable without a TestBed.
 */
export type RequestWindowFormValue = {
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
};

/** The ways a fully-populated requested window can be invalid. */
export type RequestWindowProblem = "endNotAfterStart" | "endInPast" | "exceedsMaxWindow";

/**
 * Composes the form's local dates and times into an absolute window; `null` while any field is
 * blank or unparseable.
 *
 * `new Date("YYYY-MM-DDTHH:mm")` parses as local time; the SDK serializes to UTC on the way out.
 */
export function composeRequestWindow(
  value: RequestWindowFormValue,
): { start: Date; end: Date } | null {
  const { startDate, startTime, endDate, endTime } = value;
  if (!startDate || !startTime || !endDate || !endTime) {
    return null;
  }
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return { start, end };
}

/**
 * Validates a requested window, mirroring the three server checks: end strictly after start, not
 * already elapsed, and within `maxWindowSeconds`. `null` for a valid or incomplete window.
 *
 * `maxWindowSeconds` has no default on purpose: it is the governing rule's cap, which only the
 * pre-check knows.
 */
export function requestWindowProblem(
  value: RequestWindowFormValue,
  maxWindowSeconds: number,
  now: Date = new Date(),
): RequestWindowProblem | null {
  const window = composeRequestWindow(value);
  if (window == null) {
    return null;
  }
  const spanMs = window.end.getTime() - window.start.getTime();
  if (spanMs <= 0) {
    return "endNotAfterStart";
  }
  // Elapsed-window check comes first: it's wrong wherever it sits, and moving it into the future
  // is the fix the requester must make before length matters.
  if (window.end.getTime() <= now.getTime()) {
    return "endInPast";
  }
  return spanMs > maxWindowSeconds * 1000 ? "exceedsMaxWindow" : null;
}

/** `YYYY-MM-DD` for a date, in local time — the value shape `<input type="date">` expects. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `HH:mm` for a date, in local time — the value shape `<input type="time">` expects. */
export function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const SLOT_MINUTES = 30;

/** `HH:mm` start times offered for `date`: now and each half hour after it today, every half hour on a later day. */
export function startTimeSlots(date: string, now: Date): string[] {
  const today = date === toDateInputValue(now);
  const slots = today ? [toTimeInputValue(now)] : [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const first = today ? (Math.floor(nowMinutes / SLOT_MINUTES) + 1) * SLOT_MINUTES : 0;
  for (let minutes = first; minutes < 24 * 60; minutes += SLOT_MINUTES) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    slots.push(`${hours}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return slots;
}

/** The instant `seconds` after the given local start; `null` while the start is blank or unparseable. */
export function windowEndAt(
  startDate: string | null | undefined,
  startTime: string | null | undefined,
  seconds: number,
): Date | null {
  if (!startDate || !startTime) {
    return null;
  }
  const start = new Date(`${startDate}T${startTime}`);
  return Number.isNaN(start.getTime()) ? null : new Date(start.getTime() + seconds * 1000);
}

/** Below a minute the time inputs, which step in minutes, can't hold distinct values. */
const MIN_SEEDABLE_WINDOW_SECONDS = 60;

/** Seed values for a window starting at `now` and running `durationSeconds`. */
export function defaultRequestWindow(
  now: Date,
  durationSeconds: number,
): Record<keyof RequestWindowFormValue, string> {
  const end = new Date(
    now.getTime() + Math.max(durationSeconds, MIN_SEEDABLE_WINDOW_SECONDS) * 1000,
  );
  return {
    startDate: toDateInputValue(now),
    startTime: toTimeInputValue(now),
    endDate: toDateInputValue(end),
    endTime: toTimeInputValue(end),
  };
}
