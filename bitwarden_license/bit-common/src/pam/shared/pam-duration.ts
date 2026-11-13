import { PamInputError } from "./pam-input-error";
import { sanitizeUntrusted } from "./sanitize-untrusted";

/** The server's ceiling for a lease or a window, which it reports as the cap of a rule with no maximum. */
export const MAX_PAM_DURATION_SECONDS = 365 * 24 * 60 * 60;

const UNIT_SECONDS: Readonly<Record<string, number>> = Object.freeze({
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
});

/**
 * Parses `30m`, `2h`, `1d`, `45s` or a raw number of seconds into seconds. Only whole, positive
 * values up to 365 days are accepted.
 * @param label Names the option in the refusal, such as `--duration`.
 * @throws PamInputError when the text is not a duration or is out of range.
 */
export function parseDuration(text: string | null | undefined, label = "duration"): number {
  const match = /^(\d+)([smhd]?)$/i.exec(text?.trim() ?? "");
  if (match == null) {
    throw new PamInputError(
      `\`${sanitizeUntrusted(text, 32)}\` is not a valid ${label}. Use a number of seconds or a value such as 30m, 2h or 1d.`,
    );
  }
  const seconds = Number(match[1]) * (UNIT_SECONDS[match[2].toLowerCase()] ?? 1);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new PamInputError(`The ${label} must be greater than zero.`);
  }
  if (seconds > MAX_PAM_DURATION_SECONDS) {
    throw new PamInputError(`The ${label} cannot be longer than 365 days.`);
  }
  return seconds;
}
