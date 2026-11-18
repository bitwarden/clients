const DEFAULT_LOCALE = "en-US";

/** Whole days between an instant and now as a relative phrase, such as "3 days ago". */
export function formatRotationAge(iso: string, now: number, locale: string = DEFAULT_LOCALE) {
  const days = Math.round((Date.parse(iso) - now) / 86_400_000);
  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(days, "day");
}
