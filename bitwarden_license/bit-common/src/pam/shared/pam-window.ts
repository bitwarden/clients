import { MAX_PAM_DURATION_SECONDS } from "./pam-duration";
import { PamInputError } from "./pam-input-error";

export interface PamWindow {
  readonly start: Date;
  readonly end: Date;
}

/**
 * Mirrors the server's three window checks so a bad window fails before anything is sent: the end
 * must come after the start, the end must be in the future, and the span may not exceed the
 * maximum. The end-in-the-future check runs before the length check, since moving the window
 * forward is the first fix to make.
 * @param maxSeconds The longest span allowed, 365 days unless the rule's own cap is known.
 * @throws PamInputError when the window is not valid.
 */
export function validateWindow(
  start: Date,
  end: Date,
  options: { now?: Date; maxSeconds?: number } = {},
): PamWindow {
  const now = options.now ?? new Date();
  const maxSeconds = options.maxSeconds ?? MAX_PAM_DURATION_SECONDS;
  const spanMs = end.getTime() - start.getTime();
  if (Number.isNaN(spanMs) || spanMs <= 0) {
    throw new PamInputError("The end must be after the start.");
  }
  if (end.getTime() <= now.getTime()) {
    throw new PamInputError("The end must be in the future.");
  }
  if (spanMs > maxSeconds * 1000) {
    throw new PamInputError(`The window cannot be longer than ${maxSeconds} seconds.`);
  }
  return { start, end };
}
