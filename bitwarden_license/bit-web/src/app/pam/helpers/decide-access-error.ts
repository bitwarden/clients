import { serverErrorSentence } from "../abstractions/api-error";

/**
 * The decide endpoint's two `409`s, meaning the row is no longer pending, as the server words them.
 * Its `400`s are prevented by the surfaces themselves, so they stay generic.
 */
export const DECIDE_ACCESS_SERVER_ERRORS = Object.freeze({
  /** Withdrawn, retracted or decided by another approver; the server words all three alike. */
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
 * Whether a rejected decision means the request has left the pending set. The inbox then re-reads
 * rather than restoring a resolved request to the queue.
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
