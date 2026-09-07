/**
 * Maximum window length the PAM server accepts for a single access request (24h); caps both the
 * automatic path's duration and the human path's start/end span.
 *
 * The SDK exposes the same cap as `max_request_access_window_seconds()`; replace this constant
 * once a published `sdk-internal` carries it.
 */
export const MAX_REQUEST_ACCESS_WINDOW_SECONDS = 86_400;

/**
 * The three control values the human-path request form collects: a local calendar date plus a
 * start and end time, kept as raw strings so this module is unit-testable without a TestBed.
 *
 * The single date also carries a window crossing midnight — see {@link composeRequestWindow}.
 */
export type RequestWindowFormValue = {
  date?: string | null;
  start?: string | null;
  end?: string | null;
};

/** The ways a fully-populated requested window can be invalid. */
export type RequestWindowProblem = "zeroLengthWindow" | "endInPast" | "exceedsMaxWindow";

/**
 * Composes the form's local date + times into an absolute window; `null` while any field is
 * blank or unparseable.
 *
 * An end earlier than the start rolls to the next local calendar day, so a DST boundary can't
 * shift the wall-clock end typed — left for {@link requestWindowProblem} to refuse if equal
 * instead.
 *
 * `new Date("YYYY-MM-DDTHH:mm")` parses as local time; the SDK serializes to UTC on the way out.
 */
export function composeRequestWindow(
  value: RequestWindowFormValue,
): { start: Date; end: Date } | null {
  const { date, start, end } = value;
  if (!date || !start || !end) {
    return null;
  }
  const startAt = new Date(`${date}T${start}`);
  const endAt = new Date(`${date}T${end}`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }
  if (endAt.getTime() < startAt.getTime()) {
    endAt.setDate(endAt.getDate() + 1);
  }
  return { start: startAt, end: endAt };
}

/** The composed end when the window crosses midnight; `null` otherwise or incomplete. Spelled out under the field, not left to assume. */
export function midnightCrossingEnd(value: RequestWindowFormValue): Date | null {
  const window = composeRequestWindow(value);
  if (window == null) {
    return null;
  }
  return toDateInputValue(window.end) === toDateInputValue(window.start) ? null : window.end;
}

/**
 * Validates a requested window, mirroring the three server checks: end strictly after start, not
 * already elapsed, and within `maxWindowSeconds`. `null` for a valid or incomplete window.
 *
 * The zero-length check is measured on the composed window, after an inverted end has rolled to
 * the next day; `maxWindowSeconds` comes from the pre-check's governing rule, defaulting to the
 * global ceiling, and is checked on the END since the form seeds `start` at `now`.
 */
export function requestWindowProblem(
  value: RequestWindowFormValue,
  maxWindowSeconds: number = MAX_REQUEST_ACCESS_WINDOW_SECONDS,
  now: Date = new Date(),
): RequestWindowProblem | null {
  const window = composeRequestWindow(value);
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

/**
 * Bounds on the window {@link defaultRequestWindow} may seed, imposed by the form's shape, not
 * any rule: below a minute the two time inputs can't hold distinct values, and at a full 24h
 * the end lands back on the start's wall-clock time, which {@link composeRequestWindow} reads
 * as ambiguous.
 */
const MIN_SEEDABLE_WINDOW_SECONDS = 60;
const MAX_SEEDABLE_WINDOW_SECONDS = MAX_REQUEST_ACCESS_WINDOW_SECONDS - 60;

/**
 * Seed values for a window starting at `now` and running `durationSeconds`. An end past midnight
 * is seeded as the plain wall-clock time it falls on — {@link composeRequestWindow} reads it
 * back onto the next day — so a late fold-out still offers the rule's whole default duration.
 */
export function defaultRequestWindow(now: Date, durationSeconds: number): RequestWindowFormValue {
  const seconds = Math.min(
    Math.max(durationSeconds, MIN_SEEDABLE_WINDOW_SECONDS),
    MAX_SEEDABLE_WINDOW_SECONDS,
  );
  // Both bounds are whole minutes, so truncating the end to `HH:mm` can't collapse or stretch
  // it onto the start's minute.
  const end = new Date(now.getTime() + seconds * 1000);
  return {
    date: toDateInputValue(now),
    start: toTimeInputValue(now),
    end: toTimeInputValue(end),
  };
}
