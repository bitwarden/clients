import { PamInputError } from "./pam-input-error";
import { sanitizeUntrusted } from "./sanitize-untrusted";

const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/i;

/**
 * Parses an ISO 8601 date (`2026-03-01`) or date and time (`2026-03-01T09:30:00Z`,
 * `2026-03-01T09:30+02:00`). A date alone is midnight UTC, and a time with no offset is UTC, so
 * the result never depends on the machine's time zone. Impossible dates such as February 30 are
 * refused rather than rolled over.
 * @param label Names the option in the refusal, such as `--start`.
 * @throws PamInputError when the text is not a valid date.
 */
export function parseIsoDate(text: string | null | undefined, label = "date"): Date {
  const fail = () =>
    new PamInputError(
      `\`${sanitizeUntrusted(text, 40)}\` is not a valid ${label}. Use an ISO 8601 date or UTC date and time, such as 2026-03-01T09:30:00Z.`,
    );
  const match = ISO_PATTERN.exec(text?.trim() ?? "");
  if (match == null) {
    throw fail();
  }
  const [, year, month, day, hour = "0", minute = "0", second = "0", millis = "0", zone = "Z"] =
    match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const utc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  const check = new Date(utc);
  const roundTrips =
    check.getUTCFullYear() === parts[0] &&
    check.getUTCMonth() === parts[1] - 1 &&
    check.getUTCDate() === parts[2] &&
    check.getUTCHours() === parts[3] &&
    check.getUTCMinutes() === parts[4] &&
    check.getUTCSeconds() === parts[5];
  if (!roundTrips) {
    throw fail();
  }

  let offsetMinutes = 0;
  if (zone.toUpperCase() !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 23 || offsetMins > 59) {
      throw fail();
    }
    offsetMinutes = (zone[0] === "-" ? -1 : 1) * (offsetHours * 60 + offsetMins);
  }
  // Pad to three digits so `.5` reads as 500 ms.
  const milliseconds = Number(millis.padEnd(3, "0"));
  return new Date(utc + milliseconds - offsetMinutes * 60_000);
}

/** The ISO 8601 UTC form every PAM response uses. */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}
