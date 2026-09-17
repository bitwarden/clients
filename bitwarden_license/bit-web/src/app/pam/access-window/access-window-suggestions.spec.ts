import { toTimeValue } from "./access-window";
import {
  WORK_DAY_END_HOUR,
  WORK_DAY_START_HOUR,
  fromTimeSuggestions,
  dayTimes,
  isToday,
  toSuggestions,
} from "./access-window-suggestions";

const DAY = 24 * 60 * 60;

/** Local-time helper, so a test reads as a wall clock rather than a timestamp. */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2099, 2, day, hour, minute, 0, 0);
}

describe("isToday", () => {
  it("recognises the reference clock's own day", () => {
    expect(isToday("2099-03-04", at(4, 13))).toBe(true);
    expect(isToday("2099-03-05", at(4, 13))).toBe(false);
    expect(isToday("", at(4, 13))).toBe(false);
    expect(isToday(null, at(4, 13))).toBe(false);
  });
});

describe("fromTimeSuggestions", () => {
  describe("on today", () => {
    const now = at(4, 13, 20);
    const suggestions = fromTimeSuggestions("2099-03-04", now);

    it("leads with now, truncated to the minute", () => {
      expect(suggestions[0].kind).toEqual({ type: "now" });
      expect(toTimeValue(suggestions[0].at)).toBe("13:20");
      expect(suggestions[0].at.getSeconds()).toBe(0);
    });

    it("climbs the half-hour grid rather than offsetting the current minute", () => {
      expect(suggestions.slice(1, 5).map((s) => toTimeValue(s.at))).toEqual([
        "13:30",
        "14:00",
        "14:30",
        "15:00",
      ]);
    });

    it("runs to the end of the day, so a late point is reachable from an early start", () => {
      expect(toTimeValue(suggestions[suggestions.length - 1].at)).toBe("23:30");
      expect(suggestions.map((s) => toTimeValue(s.at))).toContain("21:00");
    });

    it("labels every step but the first with the offset it really is", () => {
      // Off a 13:20 reference the grid is ten minutes out of phase, which is what the labels say
      // — and what `smoothSpan` rounds off before a requester reads it.
      expect(suggestions.slice(1, 3).map((s) => s.kind)).toEqual([
        { type: "offset", seconds: 10 * 60 },
        { type: "offset", seconds: 40 * 60 },
      ]);
    });

    it("never repeats the current minute as a step", () => {
      const onTheGrid = fromTimeSuggestions("2099-03-04", at(4, 13, 30));
      expect(onTheGrid[0].kind).toEqual({ type: "now" });
      expect(toTimeValue(onTheGrid[1].at)).toBe("14:00");
    });

    /**
     * A step that lands tomorrow would contradict the day button beside it, which still says
     * "Today" — so late in the evening the ladder shortens rather than silently re-dating.
     */
    it("drops the steps that would spill past midnight", () => {
      const late = fromTimeSuggestions("2099-03-04", at(4, 23, 10));
      expect(late.map((s) => toTimeValue(s.at))).toEqual(["23:10", "23:30"]);
    });

    it("offers now alone in the last half hour of the day", () => {
      const lastMinutes = fromTimeSuggestions("2099-03-04", at(4, 23, 55));
      expect(lastMinutes).toHaveLength(1);
      expect(lastMinutes[0].kind).toEqual({ type: "now" });
    });
  });

  describe("on any other day", () => {
    const suggestions = fromTimeSuggestions("2099-03-07", at(4, 13, 20));

    // A future day has no "now" to be relative to, so it reads as a wall-clock ladder instead.
    it("offers no relative step", () => {
      expect(suggestions.every((s) => s.kind.type === "timeOfDay")).toBe(true);
    });

    it("spans the working day in half-hour steps, between the off-hours anchors", () => {
      expect(toTimeValue(suggestions[0].at)).toBe("00:00");
      expect(toTimeValue(suggestions[1].at)).toBe(`0${WORK_DAY_START_HOUR}:00`);
      expect(toTimeValue(suggestions[suggestions.length - 2].at)).toBe(`${WORK_DAY_END_HOUR}:00`);
      expect(toTimeValue(suggestions[suggestions.length - 1].at)).toBe("21:00");
      expect(suggestions).toHaveLength((WORK_DAY_END_HOUR - WORK_DAY_START_HOUR) * 2 + 3);
    });

    it("puts every slot on the day asked for, not the reference day", () => {
      expect(suggestions.every((s) => s.at.getDate() === 7)).toBe(true);
    });

    it("is empty for an unparseable day rather than guessing one", () => {
      expect(fromTimeSuggestions("not-a-date", at(4, 13))).toEqual([]);
    });

    /**
     * The blank this is actually handed is `""` — every control signal resets to it — which a
     * `??` fallback walks straight past into an unparseable date and an empty ladder.
     */
    it("falls back to the reference day when handed a blank day", () => {
      const blank = fromTimeSuggestions("", at(4, 13, 20));
      expect(blank.length).toBeGreaterThan(0);
      expect(blank.every((s) => s.at.getDate() === 4)).toBe(true);
    });
  });
});

describe("toSuggestions", () => {
  const now = at(4, 9);
  const start = at(4, 9);

  it("orders spans and named points into one chronological list", () => {
    const suggestions = toSuggestions(start, DAY, now);
    const times = suggestions.map((s) => s.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("leaves the ladder untouched from a start already on a boundary", () => {
    const suggestions = toSuggestions(at(4, 9, 30), DAY, at(4, 9, 30));
    expect(suggestions.slice(0, 3).map((s) => toTimeValue(s.at))).toEqual([
      "10:00",
      "10:30",
      "11:30",
    ]);
  });

  it("offers the span ladder off the start", () => {
    const spans = toSuggestions(start, DAY, now)
      .filter((s) => s.kind.type === "span")
      .map((s) => (s.kind as { seconds: number }).seconds);
    expect(spans).toEqual([30 * 60, 60 * 60, 2 * 60 * 60, 4 * 60 * 60, 8 * 60 * 60]);
  });

  it("offers the end of the working day, midnight, and the next day's midday", () => {
    const named = toSuggestions(start, 48 * 60 * 60, now).filter((s) =>
      ["endOfWorkDay", "midnight", "nextDayMidday"].includes(s.kind.type),
    );
    expect(named.map((s) => [s.kind.type, s.at.getDate(), toTimeValue(s.at)])).toEqual([
      ["endOfWorkDay", 4, "18:00"],
      // Midnight CLOSING the start's day, which is the next calendar day at 00:00.
      ["midnight", 5, "00:00"],
      ["nextDayMidday", 5, "12:00"],
    ]);
  });

  /**
   * The midday anchor steps one calendar day, weekend or not. Asserted rather than assumed
   * because the kind was once called `nextWorkDayMidday`, which claimed a skip it never made.
   */
  it("steps one calendar day to midday, even into a weekend", () => {
    // 2099-03-06 is a Friday, so the anchor lands on the Saturday.
    const friday = at(6, 9);
    const midday = toSuggestions(friday, 48 * 60 * 60, friday).find(
      (s) => s.kind.type === "nextDayMidday",
    );
    expect(midday?.at.getDay()).toBe(6);
    expect(midday?.at.getDate()).toBe(7);
  });

  it("offers nothing at or before the start", () => {
    expect(toSuggestions(start, DAY, now).every((s) => s.at.getTime() > start.getTime())).toBe(
      true,
    );
  });

  /**
   * The point of filtering here rather than only in the validator: a requester who stays on the
   * suggestions cannot compose a window the server would refuse.
   */
  it("offers nothing past the rule's cap", () => {
    const suggestions = toSuggestions(start, 2 * 60 * 60, now);
    expect(suggestions.every((s) => s.at.getTime() - start.getTime() <= 2 * 60 * 60 * 1000)).toBe(
      true,
    );
    expect(suggestions.map((s) => toTimeValue(s.at))).toEqual(["09:30", "10:00", "11:00"]);
  });

  it("offers nothing already in the past, for a start that has elapsed", () => {
    const elapsed = at(4, 6);
    expect(toSuggestions(elapsed, DAY, now).every((s) => s.at.getTime() > now.getTime())).toBe(
      true,
    );
  });

  /**
   * The whole point of snapping: from an odd start the ladder still reads as clock times a person
   * would choose, not as the start's minutes carried forward all afternoon.
   */
  it("lands every suggestion on a clock boundary, from an odd start", () => {
    const start = at(4, 14, 3);
    const suggestions = toSuggestions(start, 24 * 60 * 60, start);
    expect(suggestions.map((s) => toTimeValue(s.at))).toEqual([
      "15:00",
      "15:30",
      "16:30",
      "18:00",
      "18:30",
      "22:30",
      "00:00",
      "12:00",
    ]);
  });

  /** Snapping is upward, so a suggestion is never earlier than the step that produced it. */
  it("never snaps a step back below the span it was built from", () => {
    const start = at(4, 14, 3);
    const [first] = toSuggestions(start, 24 * 60 * 60, start);
    expect(first.at.getTime() - start.getTime()).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  /** The label is re-derived after snapping, so it can never disagree with the time beside it. */
  it("labels a snapped step with the span it actually buys", () => {
    const start = at(4, 14, 3);
    const [first] = toSuggestions(start, 24 * 60 * 60, start);
    expect(first.kind).toEqual({ type: "span", seconds: 57 * 60 });
  });

  // A snapped step can land exactly on a fixed point; the fixed point is the one kept.
  it("collapses a span that lands exactly on a fixed point", () => {
    const start = at(4, 14);
    const suggestions = toSuggestions(start, 24 * 60 * 60, start);
    const atSix = suggestions.filter((s) => toTimeValue(s.at) === "18:00");
    expect(atSix).toHaveLength(1);
    expect(atSix[0].kind.type).toBe("endOfWorkDay");
  });

  it("keeps two ladder steps that are merely adjacent", () => {
    const suggestions = toSuggestions(start, DAY, now);
    expect(suggestions.filter((s) => ["09:30", "10:00"].includes(toTimeValue(s.at)))).toHaveLength(
      2,
    );
  });

  it("offers a single option under a rule narrower than the shortest step", () => {
    expect(toSuggestions(start, 15 * 60, now)).toEqual([]);
    expect(toSuggestions(start, 30 * 60, now).map((s) => toTimeValue(s.at))).toEqual(["09:30"]);
  });
});

describe("dayTimes", () => {
  it("spans the working day on the date given, inclusive of both ends", () => {
    const times = dayTimes("2099-03-06").map((t) => toTimeValue(t.at));
    expect(times).toContain(`0${WORK_DAY_START_HOUR}:00`);
    expect(times).toContain(`${WORK_DAY_END_HOUR}:00`);
    expect(dayTimes("2099-03-06").every((t) => t.at.getDate() === 6)).toBe(true);
  });

  /**
   * The evening is where the old ladder simply stopped, so an end at 9pm or at midnight could
   * only be reached by typing it. Midnight is the one that OPENS the day, which is the same
   * instant as the end of the day before — the reading the To side needs.
   */
  it("offers the off-hours anchors either side of the working day, in order", () => {
    const times = dayTimes("2099-03-06").map((t) => toTimeValue(t.at));
    expect(times[0]).toBe("00:00");
    expect(times[times.length - 1]).toBe("21:00");
    expect(times).toEqual([...times].sort());
  });

  it("is empty for an unparseable date rather than guessing one", () => {
    expect(dayTimes("nope")).toEqual([]);
  });
});
