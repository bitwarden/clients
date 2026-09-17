import { toDateValue } from "./access-window";

/**
 * The working day the time suggestions are anchored to, in local hours.
 *
 * Not a policy — a governing rule says nothing about office hours. It is the scheduling
 * convention a requester reads a day through, the same one calendar apps open a day view on,
 * and it keeps a future day's ladder to a scannable length instead of 48 half-hour rows.
 */
export const WORK_DAY_START_HOUR = 8;
export const WORK_DAY_END_HOUR = 18;

/** Step between the time suggestions on any one day, in minutes. */
const DAY_STEP_MINUTES = 30;

/**
 * Points outside the working day that people still schedule to, in local hours.
 *
 * The ladder between {@link WORK_DAY_START_HOUR} and {@link WORK_DAY_END_HOUR} is where the
 * density belongs, but it is not where a day ends: an incident worked in the evening runs to
 * 9pm or to midnight, and before these were offered the only way to say either was the typed
 * escape hatch. Midnight is the one that OPENS the day, which is the same instant as the end of
 * the day before — so on the To side, picking tomorrow at 12:00 AM is how "until midnight
 * tonight" gets expressed.
 */
const OFF_HOURS_ANCHOR_HOURS = [0, 21];

/**
 * How close two suggested ends have to be before the later-offered one is dropped as noise.
 *
 * Comfortably under the 30-minute minimum step, so it can only ever collapse a span against a
 * named point, never two steps of the ladder against each other.
 */
const COLLAPSE_WITHIN_MS = 20 * 60 * 1000;

/** Span steps the To ladder is built from, in seconds, before it is snapped to the clock. */
const TO_SPAN_SECONDS = [30 * 60, 60 * 60, 2 * 60 * 60, 4 * 60 * 60, 8 * 60 * 60];

/** The clock boundary the To ladder lands on. */
const TO_SNAP_MINUTES = 30;

/**
 * What a suggested instant *means*, kept separate from how it reads. The picker formats these
 * against the active locale; this module stays locale-free so it can be tested as arithmetic.
 */
export type SuggestionKind =
  | { type: "now" }
  /** A relative step from now — "in 1 hour". */
  | { type: "offset"; seconds: number }
  /** A wall-clock slot on a day that isn't today, with no relative reading to give it. */
  | { type: "timeOfDay" }
  /** A span from the chosen start — "1 hour of access". */
  | { type: "span"; seconds: number }
  | { type: "endOfWorkDay" }
  | { type: "midnight" }
  /**
   * Midday the day after the start — NOT the next working day. From a Friday start it lands on
   * the Saturday, which is the honest reading of what this anchor computes; whether it should
   * skip a weekend instead is a product question, not something the name should quietly imply.
   */
  | { type: "nextDayMidday" };

export type AccessWindowSuggestion = { at: Date; kind: SuggestionKind };

/** Whether a `YYYY-MM-DD` control value names today's local calendar day. */
export function isToday(dateValue: string | null | undefined, now: Date): boolean {
  return !!dateValue && dateValue === toDateValue(now);
}

/** A copy of `day` with the wall-clock time replaced, seconds and below cleared. */
export function atTime(day: Date, hour: number, minute: number): Date {
  const at = new Date(day);
  at.setHours(hour, minute, 0, 0);
  return at;
}

/** A copy of `day` moved by whole calendar days, which is not the same as adding 24 hours. */
export function addDays(day: Date, days: number): Date {
  const at = new Date(day);
  at.setDate(at.getDate() + days);
  return at;
}

/**
 * The next {@link TO_SNAP_MINUTES} boundary at or after `at`.
 *
 * Both ladders land on this grid, and every suggestion reads as a clock time with its relative
 * sense as the gloss: "5:00 PM" is a decision a person can hold in their head where "4:35 PM" is
 * arithmetic showing through. The From ladder used to be bare offsets from the current minute
 * instead — now, +30 min, +1 hr, +2 hr, +4 hr — which put five ragged times in front of a
 * requester and no way to say "half past nine".
 */
function snapUp(at: Date): Date {
  const snapped = new Date(at);
  snapped.setSeconds(0, 0);
  const remainder = snapped.getMinutes() % TO_SNAP_MINUTES;
  if (remainder !== 0) {
    snapped.setMinutes(snapped.getMinutes() + (TO_SNAP_MINUTES - remainder));
  }
  return snapped;
}

/** The first grid slot strictly after `at`, so a ladder anchored on the clock never repeats it. */
function firstSlotAfter(at: Date): Date {
  const snapped = snapUp(at);
  return snapped.getTime() > at.getTime() ? snapped : addMinutes(snapped, DAY_STEP_MINUTES);
}

function addMinutes(at: Date, minutes: number): Date {
  const moved = new Date(at);
  moved.setMinutes(moved.getMinutes() + minutes);
  return moved;
}

/**
 * The From-time suggestions for the day the requester picked.
 *
 * Today leads with "now" — access starting this minute is the overwhelmingly common ask — and
 * then climbs the same half-hour grid every other day uses, to the end of the day. Each step
 * keeps its relative sense as a gloss ("in 2 hr"), which is the reading a requester can trust
 * without doing arithmetic against the clock; the clock time is what they point at.
 *
 * It runs to the end of the day rather than to a fixed number of steps: a ladder that stopped
 * four hours out could not say "9:00 PM" from an afternoon start, and the day is the unit the
 * control beside it names. Nothing spills past midnight, so that day button stays true.
 *
 * Any other day has no "now" to be relative to, so it reads as {@link dayTimes} alone.
 */
export function fromTimeSuggestions(
  dateValue: string | null | undefined,
  now: Date,
): AccessWindowSuggestion[] {
  if (!isToday(dateValue, now)) {
    // `||`, not `??`: the blank this component actually produces is the empty string (the four
    // control signals reset to `""`), which `??` walks straight past into `new Date("T00:00")` and
    // an empty ladder.
    return dayTimes(dateValue || toDateValue(now));
  }

  // Truncated to the minute: the control holds `HH:mm`, so a seconds component would be dropped
  // on the way in and reappear as a window a few seconds longer than offered.
  const current = new Date(now);
  current.setSeconds(0, 0);
  const endOfToday = atTime(addDays(current, 1), 0, 0);

  const suggestions: AccessWindowSuggestion[] = [{ at: current, kind: { type: "now" } }];
  for (
    let at = firstSlotAfter(current);
    at.getTime() < endOfToday.getTime();
    at = addMinutes(at, DAY_STEP_MINUTES)
  ) {
    suggestions.push({
      at,
      kind: { type: "offset", seconds: (at.getTime() - current.getTime()) / 1000 },
    });
  }
  return suggestions;
}

/**
 * The wall-clock times offered on one named day: the half-hour ladder across its working hours,
 * plus the {@link OFF_HOURS_ANCHOR_HOURS} either side of them.
 *
 * Shared by the From side on a future day and by the To side's day/time pair, which both need an
 * absolute time on a named day with no relative reading to offer instead. Chronological, so the
 * midnight that opens the day leads and the evening anchor closes it.
 */
export function dayTimes(dateValue: string): AccessWindowSuggestion[] {
  const day = new Date(`${dateValue}T00:00`);
  if (Number.isNaN(day.getTime())) {
    return [];
  }
  const minutes = new Set<number>(OFF_HOURS_ANCHOR_HOURS.map((hour) => hour * 60));
  for (
    let minute = WORK_DAY_START_HOUR * 60;
    minute <= WORK_DAY_END_HOUR * 60;
    minute += DAY_STEP_MINUTES
  ) {
    minutes.add(minute);
  }
  return [...minutes]
    .sort((a, b) => a - b)
    .map((minute) => ({
      at: atTime(day, Math.floor(minute / 60), minute % 60),
      kind: { type: "timeOfDay" as const },
    }));
}

/**
 * Where a future day's ladder rests before the requester picks. Nine, not
 * {@link WORK_DAY_START_HOUR}: a control resting on the ladder's first slot reads as unset.
 *
 * Already `HH:mm`, so no caller has to zero-pad it back into the control's shape.
 */
export const DEFAULT_FUTURE_DAY_TIME = "09:00";

/**
 * The start plus the governing rule's cap. Bounds the To side's DAY controls as well as its
 * times: without it the calendar can address a day no admissible end lives on, and the time list
 * behind it comes back empty only after the requester has picked.
 */
export function latestAdmissibleEnd(start: Date, maxWindowSeconds: number): Date {
  return new Date(start.getTime() + maxWindowSeconds * 1000);
}

/**
 * The one test an end has to pass: after the start, still ahead of the clock, inside the cap.
 *
 * Exported because "a requester on the suggestions cannot compose a window the server refuses"
 * holds only while the ladder, the anchors, the day/time pair and both calendars filter by the
 * same predicate. Written out per caller, four copies had to be kept in step by hand.
 */
export function admissibleEnd(
  start: Date,
  maxWindowSeconds: number,
  now: Date,
): (suggestion: AccessWindowSuggestion) => boolean {
  const latest = latestAdmissibleEnd(start, maxWindowSeconds).getTime();
  return ({ at }) =>
    at.getTime() > start.getTime() && at.getTime() > now.getTime() && at.getTime() <= latest;
}

/**
 * The To suggestions for a chosen start, ordered by the instant they end at.
 *
 * Two families are offered, then merged into one chronological list rather than grouped: a
 * clock-aligned ladder off the start (see {@link snapUp}), and the fixed points a person actually
 * schedules to — the close of the working day, midnight, midday tomorrow. Merging them is what makes the list scannable, since
 * the question being answered ("when do I stop needing this?") is about the clock, not about
 * which family an option came from.
 *
 * Everything is filtered to what submit would accept: past the start, still ahead of `now`, and
 * inside the governing rule's cap. So a requester who stays on the suggestions cannot compose a
 * window the server will refuse — that is the point of the redesign, and why the cap has to
 * reach this function rather than only the validator.
 *
 * Where a span lands on or near a fixed point, the fixed point wins, because its clock reading is
 * the round one: 6:00 PM reads as a decision, 6:03 PM reads as arithmetic. Near, not exactly —
 * under a four-hour rule a 2:03 PM start puts the cap at 6:03 PM and the close of the working day
 * at 6:00 PM, and offering both is three minutes of difference dressed up as a choice.
 */
export function toSuggestions(
  start: Date,
  maxWindowSeconds: number,
  now: Date,
): AccessWindowSuggestion[] {
  // Snapped to the clock, then re-labelled with the span it actually buys — so the label can
  // never disagree with the time beside it.
  const spans: AccessWindowSuggestion[] = TO_SPAN_SECONDS.map((seconds) => {
    const at = snapUp(new Date(start.getTime() + seconds * 1000));
    return {
      at,
      kind: { type: "span" as const, seconds: (at.getTime() - start.getTime()) / 1000 },
    };
  });

  const anchors: AccessWindowSuggestion[] = [
    // Offered as a round hour, not as a named point — the requester reads "6:00 PM" and knows
    // what it means without being told it is the end of the working day.
    { at: atTime(start, WORK_DAY_END_HOUR, 0), kind: { type: "endOfWorkDay" } },
    // Midnight *closing* the start's day, which is the next calendar day at 00:00 — the reading
    // "for the rest of today" has, and the one an end-exclusive window needs.
    { at: atTime(addDays(start, 1), 0, 0), kind: { type: "midnight" } },
    { at: atTime(addDays(start, 1), 12, 0), kind: { type: "nextDayMidday" } },
  ];

  // Anchors go in first so a colliding span is the one dropped by the de-dupe below.
  const accepted: AccessWindowSuggestion[] = [];
  for (const suggestion of [...anchors, ...spans].filter(
    admissibleEnd(start, maxWindowSeconds, now),
  )) {
    const collides = accepted.some(
      (kept) => Math.abs(kept.at.getTime() - suggestion.at.getTime()) < COLLAPSE_WITHIN_MS,
    );
    if (!collides) {
      accepted.push(suggestion);
    }
  }
  return accepted.sort((a, b) => a.at.getTime() - b.at.getTime());
}
