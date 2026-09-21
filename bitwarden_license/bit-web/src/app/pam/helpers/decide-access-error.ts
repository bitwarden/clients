import { serverErrorSentence } from "../abstractions/api-error";

/**
 * The decide endpoint's error catalog, as the server words it, paired with the copy shown
 * instead. Reproduced here, not imported, since the strings cross the wire as prose with no
 * machine-readable code to switch on.
 *
 * Sourced from `DecideAccessRequestCommand`, and limited to its two `409`s — the refusals that
 * mean the row the approver clicked is no longer in the pending set. Its `400`s are all
 * prevented by the surfaces themselves (self-approval disables the buttons, the deny dialog
 * requires a comment, and an extension never reaches the inbox), so they stay generic.
 */
export const DECIDE_ACCESS_SERVER_ERRORS = Object.freeze({
  /**
   * Withdrawn by the requester, retracted by another manager, or decided by another approver —
   * the server words all three the same way, and so does the copy.
   */
  AlreadyResolved: {
    serverMessage: "This request has already been resolved.",
    messageKey: "pamInboxDecisionNoLongerPending",
  },
  WindowEnded: {
    serverMessage: "This request's window has already ended.",
    messageKey: "pamInboxDecisionWindowEnded",
  },
} as const satisfies Record<string, { serverMessage: string; messageKey: string }>);

/**
 * Whether a rejected decision means the request has left the pending set, rather than the call
 * having simply failed. The inbox re-reads on this instead of restoring the row it optimistically
 * removed, which would put a resolved request back in the approver's queue.
 */
export function isRequestNoLongerPendingError(e: unknown): boolean {
  const candidate = serverErrorSentence(e);
  return Object.values(DECIDE_ACCESS_SERVER_ERRORS).some((entry) =>
    candidate.includes(entry.serverMessage),
  );
}

/** The i18n key to toast for a rejected decision, generic copy included. */
export function decideAccessErrorMessageKey(e: unknown): string {
  const candidate = serverErrorSentence(e);
  const mapped = Object.values(DECIDE_ACCESS_SERVER_ERRORS).find((entry) =>
    candidate.includes(entry.serverMessage),
  );
  return mapped?.messageKey ?? "pamInboxDecisionFailed";
}
