import { type RequestWindowProblem } from "../helpers/request-access-window";

/**
 * Re-exported so this module is the single door onto the window contract. The problem set still
 * lives in `helpers/request-access-window.ts`, which the max-duration PR will delete; pointing
 * consumers here makes that a one-declaration move rather than an import rewrite.
 */
export type { RequestWindowProblem };

/**
 * The four control values the From/To access-window picker collects: a local calendar date and a
 * wall-clock time for each end of the window.
 *
 * Kept as raw `YYYY-MM-DD` / `HH:mm` strings — the shapes `<input type="date">` and
 * `<input type="time">` hold — so this module is unit-testable without a TestBed, and so the
 * Custom escape hatch can bind straight to a control.
 *
 * This is the shape's one substantive difference from {@link RequestWindowFormValue}, which
 * carried a single date and inferred a midnight crossing from an inverted end time. An explicit
 * `endDate` is what lets the To picker offer "Tomorrow at 12:00 PM" from a morning start — under
 * the single-date model that end read as *earlier the same day* and silently kept the start's day.
 */
export type AccessWindowFormValue = {
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
};

/**
 * The window control at rest, before a governing rule's bounds seed it. Here rather than in the
 * host form, so renaming a field cannot leave a consumer resetting to a shape nothing writes.
 */
export const EMPTY_ACCESS_WINDOW: AccessWindowFormValue = Object.freeze({
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
});

/** The key the window validator reports its {@link RequestWindowError} under. */
export const REQUEST_WINDOW_ERROR_KEY = "requestWindow";

/**
 * The shape reported under {@link REQUEST_WINDOW_ERROR_KEY}. `message` is already localized so
 * `bit-error` renders it through its `error[1].message` fall-through.
 */
export type RequestWindowError = { problem: RequestWindowProblem; message: string };

/** How far ahead the From calendar lets a requester schedule. An affordance, not a server rule. */
export const MAX_SCHEDULE_AHEAD_DAYS = 60;

/** `YYYY-MM-DD` for a date, in local time. */
export function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `HH:mm` for a date, in local time. */
export function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Splits an instant into the pair of control values that address it. */
export function toWindowEnd(date: Date): { date: string; time: string } {
  return { date: toDateValue(date), time: toTimeValue(date) };
}

/**
 * Composes one end of the window from its date + time controls; `null` while either is blank or
 * unparseable.
 *
 * `new Date("YYYY-MM-DDTHH:mm")` parses as local time; the SDK serializes to UTC on the way out.
 */
export function composeInstant(date?: string | null, time?: string | null): Date | null {
  if (!date || !time) {
    return null;
  }
  const at = new Date(`${date}T${time}`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Composes both ends into an absolute window; `null` unless all four controls resolve. */
export function composeAccessWindow(
  value: AccessWindowFormValue,
): { start: Date; end: Date } | null {
  const start = composeInstant(value.startDate, value.startTime);
  const end = composeInstant(value.endDate, value.endTime);
  return start == null || end == null ? null : { start, end };
}

/**
 * Validates a composed window against the same three server checks the single-date model was
 * held to: end strictly after start, not already elapsed, and within `maxWindowSeconds`.
 *
 * `null` for a valid or still-incomplete window. Reported as {@link RequestWindowProblem} so the
 * existing localized messages carry over unchanged.
 *
 * One behavioural difference falls out of the explicit end date: an end BEFORE the start is now a
 * real "end before start" mistake rather than a midnight crossing, so it lands on
 * `zeroLengthWindow` — the message for which reads as an ordering problem either way.
 */
export function accessWindowProblem(
  value: AccessWindowFormValue,
  maxWindowSeconds: number,
  now: Date = new Date(),
): RequestWindowProblem | null {
  const window = composeAccessWindow(value);
  if (window == null) {
    return null;
  }
  const spanMs = window.end.getTime() - window.start.getTime();
  if (spanMs <= 0) {
    return "zeroLengthWindow";
  }
  // Elapsed-window check comes first: it's wrong wherever it sits, and moving it into the future
  // is the fix the requester must make before length matters.
  if (window.end.getTime() <= now.getTime()) {
    return "endInPast";
  }
  return spanMs > maxWindowSeconds * 1000 ? "exceedsMaxWindow" : null;
}

/**
 * Seed values for a window starting at `now` and running the governing rule's default duration,
 * clamped to its cap.
 *
 * Unlike the single-date model this replaces, there is no upper clamp below the cap. That existed
 * because two time inputs sharing one date could not express a full 24 hours: the end landed back
 * on the start's wall-clock time, which read as ambiguous. With an explicit `endDate` a 24-hour
 * default seeds exactly as asked. The one-minute floor stays, or a rule with a zero default seeds
 * a window `accessWindowProblem` refuses on sight.
 */
export function defaultAccessWindow(
  now: Date,
  durationSeconds: number,
  maxWindowSeconds: number,
): AccessWindowFormValue {
  // Truncated to the minute, since the controls hold `HH:mm`: a seconds component would be
  // dropped on the way in and reappear as a window slightly longer than the one seeded.
  const start = new Date(now);
  start.setSeconds(0, 0);
  const seconds = Math.min(Math.max(durationSeconds, 60), maxWindowSeconds);
  const end = new Date(start.getTime() + seconds * 1000);
  return {
    startDate: toDateValue(start),
    startTime: toTimeValue(start),
    endDate: toDateValue(end),
    endTime: toTimeValue(end),
  };
}
