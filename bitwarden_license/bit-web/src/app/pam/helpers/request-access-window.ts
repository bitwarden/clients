/**
 * Maximum window length the PAM server accepts for a single access request (24h). Caps both the
 * automatic path's duration and the human path's start/end span.
 *
 * The SDK owns this number: it applies the same cap in
 * `AccessRequestCreateRequest::validate` before POSTing, and exposes it as
 * `max_request_access_window_seconds()` precisely so a client validating a half-typed form does not
 * have to keep its own copy. Replace this constant with that call once a published `sdk-internal`
 * carries it — it is a runtime (not type-only) import, so it belongs at the call sites in
 * `cipher-view-banner`, not in this Angular-free helper.
 */
export const MAX_REQUEST_ACCESS_WINDOW_SECONDS = 86_400;

/**
 * The three control values the human-path request form collects: one local calendar date plus a
 * start and end time on it. Kept as the raw `<input type="date">` / `<input type="time">` strings
 * so this module can be unit-tested without a form or a TestBed.
 *
 * The single date carries a window that crosses midnight too — an end time EARLIER than the start
 * resolves onto the following day. See {@link composeRequestWindow}.
 */
export type RequestWindowFormValue = {
  date?: string | null;
  start?: string | null;
  end?: string | null;
};

/** The ways a fully-populated requested window can be invalid. */
export type RequestWindowProblem = "zeroLengthWindow" | "endInPast" | "exceedsMaxWindow";

/**
 * Compose the form's local date + times into an absolute window. Returns `null` while any field is
 * still blank or unparseable, so callers can stay quiet until the requester has finished typing.
 *
 * An end time earlier than the start is read as the following day: on a form carrying one date,
 * 23:00–01:00 can only mean 01:00 tomorrow, and refusing it was the whole of PM-42593. The roll is
 * by a local calendar day rather than by a flat 24h, so the wall-clock end the requester typed is
 * the one they get across a DST boundary.
 *
 * An end EQUAL to the start is left where it sits, for {@link requestWindowProblem} to refuse. It
 * is the one shape this form cannot disambiguate — a zero-length window or a full 24h one — and
 * a mistyped time is much the likelier of the two, so it is reported rather than guessed.
 *
 * `new Date("YYYY-MM-DDTHH:mm")` (no zone suffix) is parsed as LOCAL time, which is what the
 * requester means by "2pm". The SDK serialises the resulting `Date` to UTC on the way out.
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

/**
 * The composed end when the window crosses midnight, and `null` when it does not (or while the
 * form is incomplete). The roll-over {@link composeRequestWindow} applies is inferred from an end
 * earlier than the start, so the form states the day it resolved to rather than leaving the
 * requester to assume it.
 */
export function midnightCrossingEnd(value: RequestWindowFormValue): Date | null {
  const window = composeRequestWindow(value);
  if (window == null) {
    return null;
  }
  return toDateInputValue(window.end) === toDateInputValue(window.start) ? null : window.end;
}

/**
 * Validate a requested window, mirroring the three checks the server enforces: the end must be
 * strictly after the start, the window must not have already elapsed, and the span must fit inside
 * `maxWindowSeconds`. Returns `null` for a valid window and for an incomplete one — an unfinished
 * form is not yet wrong.
 *
 * The first check reads as "zero-length" rather than "end before start" because it is measured on
 * the COMPOSED window: an end earlier than the start has already rolled to the next day by the
 * time it gets here, so the only span left that is not positive is an end equal to the start.
 *
 * `maxWindowSeconds` is the governing rule's cap as the pre-check published it, defaulting to the
 * global ceiling for a caller that has not resolved one. Checking only the global ceiling let a
 * window past the rule's own maximum look valid right up until submit rejected it.
 *
 * `now` is the instant the window is measured against, injectable so this stays testable without a
 * fake clock. The check is on the END, not the start: a window that has merely STARTED is still
 * usable, and the form seeds `start` at `now`, so rejecting a past start would fail every request
 * where the requester paused to type a justification. A window whose end has passed is the one
 * that can never be activated — `ActivateAccessRequestCommand` refuses it with "The approved access
 * window has already ended", so without this check the requester lands a pending request that is
 * dead on arrival yet still reaches an approver (PM-42592).
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
  // Ordered ahead of the span check on purpose: an elapsed window is wrong wherever it sits, and
  // "move it into the future" is the fix the requester has to make first. Length only matters once
  // the window is somewhere it could run.
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
 * Bounds on the window {@link defaultRequestWindow} may seed, both imposed by the form's shape
 * rather than by any rule. Below a minute the two time inputs cannot hold distinct values at all;
 * at a full 24h the end lands on the start's own wall-clock time, which
 * {@link composeRequestWindow} reads as ambiguous — so the seed stops one minute short, the finest
 * step the inputs offer. Clamping either bound only ever bites a rule configured at the extreme;
 * the requester can still type any window the rule allows.
 */
const MIN_SEEDABLE_WINDOW_SECONDS = 60;
const MAX_SEEDABLE_WINDOW_SECONDS = MAX_REQUEST_ACCESS_WINDOW_SECONDS - 60;

/**
 * Seed values for a window starting at `now` and running `durationSeconds`. An end past midnight
 * is seeded as the plain wall-clock time it falls on — {@link composeRequestWindow} reads it back
 * onto the following day — so a fold-out opened late in the evening still offers the rule's whole
 * default duration rather than the stub that clamping it to `23:59` used to leave (PM-42593).
 */
export function defaultRequestWindow(now: Date, durationSeconds: number): RequestWindowFormValue {
  const seconds = Math.min(
    Math.max(durationSeconds, MIN_SEEDABLE_WINDOW_SECONDS),
    MAX_SEEDABLE_WINDOW_SECONDS,
  );
  // Both bounds are whole minutes, so truncating the end to the inputs' `HH:mm` can neither
  // collapse it onto the start's minute nor stretch it onto that same minute 24h later.
  const end = new Date(now.getTime() + seconds * 1000);
  return {
    date: toDateInputValue(now),
    start: toTimeInputValue(now),
    end: toTimeInputValue(end),
  };
}
