import { formatDate } from "@angular/common";

const DEFAULT_LOCALE = "en-US";

/** "Sept 19, 2026, 7 PM" style: minutes are shown only when they are not `:00`. */
export function formatRotationTimestamp(iso: string, locale: string = DEFAULT_LOCALE): string {
  const date = new Date(iso);
  const time = date.getMinutes() === 0 ? "h a" : "h:mm a";
  return formatDate(date, `MMM d, y, ${time}`, locale);
}

/** The date part of {@link formatRotationTimestamp}, such as "Oct 1, 2026". */
export function formatRotationDate(iso: string, locale: string = DEFAULT_LOCALE): string {
  return formatDate(new Date(iso), "MMM d, y", locale);
}

/** Whole days between an instant and now as a relative phrase, such as "3 days ago". */
export function formatRotationAge(iso: string, now: number, locale: string = DEFAULT_LOCALE) {
  const days = Math.round((Date.parse(iso) - now) / 86_400_000);
  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(days, "day");
}
