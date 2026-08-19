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
 */
export type RequestWindowFormValue = {
  date?: string | null;
  start?: string | null;
  end?: string | null;
};

/** The ways a fully-populated requested window can be invalid. */
export type RequestWindowProblem = "endBeforeStart" | "exceedsMaxWindow";

/**
 * Compose the form's local date + times into an absolute window. Returns `null` while any field is
 * still blank or unparseable, so callers can stay quiet until the requester has finished typing.
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
  return { start: startAt, end: endAt };
}

/**
 * Validate a requested window, mirroring the two checks the server enforces: the end must be
 * strictly after the start, and the span must fit inside `maxWindowSeconds`. Returns `null` for a
 * valid window and for an incomplete one — an unfinished form is not yet wrong.
 *
 * `maxWindowSeconds` is the governing rule's cap as the pre-check published it, defaulting to the
 * global ceiling for a caller that has not resolved one. Checking only the global ceiling let a
 * window past the rule's own maximum look valid right up until submit rejected it.
 */
export function requestWindowProblem(
  value: RequestWindowFormValue,
  maxWindowSeconds: number = MAX_REQUEST_ACCESS_WINDOW_SECONDS,
): RequestWindowProblem | null {
  const window = composeRequestWindow(value);
  if (window == null) {
    return null;
  }
  const spanMs = window.end.getTime() - window.start.getTime();
  if (spanMs <= 0) {
    return "endBeforeStart";
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
 * Seed values for a window starting at `now` and running `durationSeconds`. Because the form
 * carries a single date, a window that would cross midnight is clamped to `23:59` on the start
 * date rather than silently rolling over to a time earlier than the start — which would otherwise
 * trip {@link requestWindowProblem} on first paint. A requester who wants a window spanning
 * midnight submits two requests; widening the form to a second date is tracked separately.
 */
export function defaultRequestWindow(now: Date, durationSeconds: number): RequestWindowFormValue {
  const end = new Date(now.getTime() + durationSeconds * 1000);
  const sameDay =
    end.getFullYear() === now.getFullYear() &&
    end.getMonth() === now.getMonth() &&
    end.getDate() === now.getDate();
  return {
    date: toDateInputValue(now),
    start: toTimeInputValue(now),
    end: sameDay ? toTimeInputValue(end) : "23:59",
  };
}
