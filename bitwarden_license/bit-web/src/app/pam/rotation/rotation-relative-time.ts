import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/** An i18n key and the count its `$COUNT$` placeholder takes. */
export type RelativeTimeText = { key: string; count?: number };

/** Renders {@link RelativeTimeText} with the caller's translator, or null when it is null. */
export function relativeTimeLabel(
  i18n: Pick<I18nService, "t">,
  text: RelativeTimeText | null,
): string | null {
  if (text == null) {
    return null;
  }
  return text.count == null ? i18n.t(text.key) : i18n.t(text.key, text.count);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago a credential last rotated. `null` for spans the design shows no wording for, which
 * the caller renders as a date.
 */
export function lastRotatedText(ms: number | null, now: number): RelativeTimeText | null {
  if (ms == null) {
    return { key: "never" };
  }
  const elapsed = now - ms;
  if (elapsed < MINUTE) {
    return { key: "justNow" };
  }
  if (elapsed < HOUR) {
    return { key: "pamRotationRelativeMinutesAgo", count: Math.floor(elapsed / MINUTE) };
  }
  const days = Math.floor(elapsed / DAY);
  if (days < 1) {
    return null;
  }
  if (days === 1) {
    return { key: "pamRotationRelativeYesterday" };
  }
  if (days < 7) {
    return { key: "pamRotationRelativeDaysAgo", count: days };
  }
  if (days < 30) {
    return { key: "pamRotationRelativeWeeksAgo", count: Math.floor(days / 7) };
  }
  if (days < 365) {
    return { key: "pamRotationRelativeMonthsAgo", count: Math.floor(days / 30) };
  }
  return null;
}

/**
 * How long ago a connector last checked in. Like {@link lastRotatedText}, but spans of an hour or
 * more within the same day read as hours rather than falling back to a date.
 */
export function lastSeenText(ms: number | null, now: number): RelativeTimeText | null {
  const text = lastRotatedText(ms, now);
  if (text != null || ms == null) {
    return text;
  }
  const elapsed = now - ms;
  if (elapsed >= HOUR && elapsed < DAY) {
    return { key: "pamRotationRelativeHoursAgo", count: Math.floor(elapsed / HOUR) };
  }
  return null;
}

/**
 * When the next rotation falls, either ahead ("In 1hr", "In 2w") or behind ("Due 3d ago"). `null`
 * for spans the design shows no wording for.
 */
export function nextRotationText(ms: number, now: number): RelativeTimeText | null {
  const until = ms - now;
  if (until >= 0) {
    const days = Math.floor(until / DAY);
    if (until >= HOUR && days < 1) {
      return { key: "pamRotationRelativeInHours", count: Math.floor(until / HOUR) };
    }
    if (days >= 7 && days < 30) {
      return { key: "pamRotationRelativeInWeeks", count: Math.floor(days / 7) };
    }
    return null;
  }
  const days = Math.floor(-until / DAY);
  if (days >= 1 && days < 7) {
    return { key: "pamRotationRelativeDueDaysAgo", count: days };
  }
  return null;
}
