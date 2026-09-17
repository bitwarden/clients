import { formatterFor } from "../date/format-duration";

/** The granularity an approximate reading is smoothed to, in minutes. */
const SMOOTH_STEP_MINUTES = 10;

/**
 * A window's length as a compact localized label: `45 min`, `4 hr`, `3 hr 45 min`, `3 days 12 hr`.
 *
 * Separate from `formatDuration` on purpose. That one picks the largest unit a duration divides
 * evenly into, which is right for the durations a *rule* is configured with (they are round by
 * construction) but wrong for a window whose ends the requester picked independently — it renders
 * 3h45m as "225 minutes". A window that runs until the end of the working day is rarely round, so
 * the label has to carry two units.
 *
 * Two units, never three, and always the two coarsest the length reaches: a multi-day window
 * reads in days and hours, and a rule whose cap allows one is no longer hypothetical — "84 hr
 * 29 min" is arithmetic the requester has to do in their head to find out it is most of a week.
 * The finest unit is dropped on the same grounds a sub-minute remainder is: the controls behind
 * this hold `HH:mm`, so precision below the reading is noise.
 */
export function formatSpan(locale: string, seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  const minutes = totalMinutes - totalHours * 60;

  const format = (unit: "day" | "hour" | "minute", value: number) =>
    formatterFor(locale, unit, "short").format(value);

  if (days > 0) {
    return hours === 0 ? format("day", days) : `${format("day", days)} ${format("hour", hours)}`;
  }
  if (totalHours === 0) {
    return format("minute", minutes);
  }
  if (minutes === 0) {
    return format("hour", totalHours);
  }
  return `${format("hour", totalHours)} ${format("minute", minutes)}`;
}

/**
 * A span as an *approximate* reading: smoothed to the nearest ten minutes, and told apart from an
 * exact one so the caller can mark it.
 *
 * Every relative reading in the picker glosses an instant that is shown exactly beside it, so a
 * minute of precision in the gloss buys nothing and costs legibility. The To ladder snaps to the
 * clock and is then labelled with the span it really buys, which from a 7:33 PM start reads
 * "1 hr 27 min" — true, unhelpful, and a number nobody chose; and a relative From reading
 * measured against a clock that has moved on since the choice reads "in 29 min" for the row that
 * offered "in 30 min".
 *
 * `approximate` is false where the rounding moved nothing, so an exact span is never hedged and
 * the marker means something when it does appear.
 *
 * Spans under one step are returned exactly. There is nothing to smooth about a number that small
 * — and rounding it would report four minutes of access as none.
 */
export function smoothSpan(
  locale: string,
  seconds: number,
): { text: string; approximate: boolean } {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  if (minutes < SMOOTH_STEP_MINUTES) {
    return { text: formatSpan(locale, minutes * 60), approximate: false };
  }
  const smoothed = Math.round(minutes / SMOOTH_STEP_MINUTES) * SMOOTH_STEP_MINUTES;
  return { text: formatSpan(locale, smoothed * 60), approximate: smoothed !== minutes };
}
