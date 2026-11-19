/** Why a PAM call was reported as unreachable. */
export type PamUnreachableReason = "network" | "timeout";

/**
 * A PAM call that never got an answer from the server: the network failed, or no answer came in
 * time. Thrown in place of the SDK's error only by a client that guards its PAM calls (desktop),
 * so a server's own refusal is never reported as one.
 */
export class PamUnreachableError extends Error {
  override readonly name = "PamUnreachableError";

  constructor(
    readonly reason: PamUnreachableReason,
    /** The SDK's own error, when there was one; never shown to the user. */
    readonly original?: unknown,
  ) {
    super(
      reason === "timeout" ? "The server did not answer in time." : "The server is unreachable.",
    );
  }
}

export function isPamUnreachableError(e: unknown): e is PamUnreachableError {
  return e instanceof PamUnreachableError;
}

/** The toast for a call that could not reach the server. */
export const PAM_UNREACHABLE_MESSAGE_KEY = "pamServerUnreachable";

/** The banner shown while PAM actions are unavailable. */
export const PAM_OFFLINE_BANNER_KEY = "pamOfflineBanner";

/** The tooltip on an action disabled while offline. */
export const PAM_OFFLINE_TOOLTIP_KEY = "pamOfflineTooltip";

/** Shown where a lease that ended while offline used to show credentials. */
export const PAM_OFFLINE_ACCESS_ENDED_KEY = "pamOfflineAccessEnded";

/**
 * The message key for a failed PAM call: the connectivity copy when the server was never reached,
 * else `fallbackKey`, so a server's own refusal keeps its specific message.
 */
export function pamFailureMessageKey(e: unknown, fallbackKey: string): string {
  return isPamUnreachableError(e) ? PAM_UNREACHABLE_MESSAGE_KEY : fallbackKey;
}
