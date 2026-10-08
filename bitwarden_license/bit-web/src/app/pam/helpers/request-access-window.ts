/** The human-path form's raw local date and time strings, kept framework-free for testing. */
export type RequestWindowFormValue = {
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
};

export type RequestWindowProblem = "endNotAfterStart" | "endInPast" | "exceedsMaxWindow";

/** `null` while any field is blank or unparseable; `YYYY-MM-DDTHH:mm` parses as local time. */
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
 * Mirrors the server's three window checks; `null` for a valid or incomplete window.
 * `maxWindowSeconds` has no default, since only the pre-check knows the rule's cap.
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
  // Checked before length, since moving the window into the future is the first fix to make.
  if (window.end.getTime() <= now.getTime()) {
    return "endInPast";
  }
  return spanMs > maxWindowSeconds * 1000 ? "exceedsMaxWindow" : null;
}

/** `YYYY-MM-DD` in local time, the value shape `<input type="date">` expects. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `HH:mm` in local time, the value shape `<input type="time">` expects. */
export function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const SLOT_MINUTES = 30;

/** Start times for `date`: now and each later half hour today, every half hour on a later day. */
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

/** The instant `seconds` after the local start; `null` while the start is blank or unparseable. */
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
