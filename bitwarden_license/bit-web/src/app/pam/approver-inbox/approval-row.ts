import { AccessRequestDetailsResponse, elapsedKey } from "@bitwarden/bit-pam";

/** An i18n `{ key, value }` pair, leaving localization to the template. */
export type LabelValue = { key: string; value: number | null };

/**
 * A pending approval, with the display fields the table renders and the literal
 * fields `bitSortable` sorts on, pre-computed once per render against a stable `now`.
 *
 * Lifted from the former approver-inbox-row card so the table rows reuse the same
 * window/elapsed/reason logic rather than re-deriving it. `cipherName` is the name
 * resolved from local vault state (never the encrypted blob); it falls back to the id.
 */
export type ApprovalRow = {
  request: AccessRequestDetailsResponse;
  // Literal fields for bitSortable + filter dropdowns.
  cipherName: string;
  collectionName: string | null;
  requester: string;
  requesterEmail: string | null;
  submittedAtMs: number;
  // Pre-computed display values.
  reason: string | null;
  elapsed: { key: string; value: number };
  duration: LabelValue;
  relativeStart: LabelValue;
  exactWindow: string;
  /** Lowercased haystack for the free-text search predicate. */
  searchText: string;
};

/** The request's reason, trimmed, or null when blank. */
export function reasonText(request: AccessRequestDetailsResponse): string | null {
  return request.reason?.trim() || null;
}

/** A coarse i18n label for the requested lease duration ("1 hour", "4 hours", "30 minutes"). */
export function durationLabel(request: AccessRequestDetailsResponse): LabelValue {
  const seconds = request.requestedTtlSeconds;
  if (seconds < 3600) {
    return { key: "pamInboxDurationMinutes", value: Math.max(1, Math.round(seconds / 60)) };
  }
  const hours = seconds / 3600;
  if (hours === 1) {
    return { key: "pamInboxDuration1Hour", value: null };
  }
  return {
    key: "pamInboxDurationHours",
    value: Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10,
  };
}

/** A relative phrase for when the window opens ("now", "today", "tomorrow", "in N days"). */
export function relativeStart(request: AccessRequestDetailsResponse, now: Date): LabelValue {
  const nb = request.requestedNotBefore;
  if (!nb) {
    return { key: "pamInboxStartAsap", value: null };
  }
  const start = new Date(Date.parse(nb));
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((startDay - today) / 86_400_000);
  if (diffDays <= 0) {
    return { key: "pamInboxStartToday", value: null };
  }
  if (diffDays === 1) {
    return { key: "pamInboxStartTomorrow", value: null };
  }
  return { key: "pamInboxStartInDays", value: diffDays };
}

/** Shared formatter for the exact-window tooltip — built once, not per row. */
const WINDOW_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

/** A fully-formatted "from – to" window for the tooltip, or "" when the window is open-ended. */
export function exactWindow(request: AccessRequestDetailsResponse): string {
  if (!request.requestedNotBefore || !request.requestedNotAfter) {
    return "";
  }
  return `${WINDOW_FORMAT.format(new Date(request.requestedNotBefore))} – ${WINDOW_FORMAT.format(new Date(request.requestedNotAfter))}`;
}

/** Build the table row for a pending request, snapshotting relative-time fields against `now`. */
export function toApprovalRow(request: AccessRequestDetailsResponse, now: Date): ApprovalRow {
  const cipherName = request.cipherName ?? request.cipherId;
  const requester = request.requesterName || request.requesterEmail || "";
  return {
    request,
    cipherName,
    collectionName: request.collectionName,
    requester,
    requesterEmail: request.requesterEmail,
    submittedAtMs: Date.parse(request.submittedAt),
    reason: reasonText(request),
    elapsed: elapsedKey(request.submittedAt, now),
    duration: durationLabel(request),
    relativeStart: relativeStart(request, now),
    exactWindow: exactWindow(request),
    searchText: [cipherName, request.collectionName, request.requesterName, request.requesterEmail]
      .filter((s): s is string => !!s)
      .join(" ")
      .toLowerCase(),
  };
}
