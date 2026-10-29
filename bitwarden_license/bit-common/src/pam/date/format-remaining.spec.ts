import { formatRemaining, formatRemainingLong } from "./format-remaining";

describe("formatRemaining", () => {
  it.each([
    [0, "0s"],
    [-1000, "0s"],
    [Number.NaN, "0s"],
    [Number.POSITIVE_INFINITY, "0s"],
    [1, "1s"],
    [15_000, "15s"],
    [59_000, "59s"],
    [60_000, "1m"],
    [59_500, "1m"], // ceils up to the next minute
    [47 * 60_000, "47m"],
    [59 * 60_000, "59m"],
    [60 * 60_000, "1h"],
    [(2 * 60 + 5) * 60_000, "2h 5m"],
    [2 * 60 * 60_000, "2h"],
  ])("formats %dms as %s", (ms, expected) => {
    expect(formatRemaining("en-US", ms)).toBe(expected);
  });

  it("localizes the units and the list", () => {
    // Built from Intl itself, so this doesn't hardcode ICU's German wording.
    const unit = (value: number, unit: "hour" | "minute") =>
      new Intl.NumberFormat("de", { style: "unit", unit, unitDisplay: "narrow" }).format(value);
    const expected = new Intl.ListFormat("de", { type: "unit", style: "narrow" }).format([
      unit(2, "hour"),
      unit(5, "minute"),
    ]);

    expect(formatRemaining("de", (2 * 60 + 5) * 60_000)).toBe(expected);
  });
});

describe("formatRemainingLong", () => {
  const DAY = 24 * 60 * 60_000;

  it.each([
    [0, "0 seconds"],
    [-1000, "0 seconds"],
    [Number.NaN, "0 seconds"],
    [1000, "1 second"],
    [30_000, "30 seconds"],
    [60_000, "1 minute"],
    [59_500, "1 minute"], // ceils up to the next minute
    [4 * 60_000, "4 minutes"],
    [59 * 60_000, "59 minutes"],
    [60 * 60_000, "1 hour"],
    [(2 * 60 + 59) * 60_000, "2 hours"],
    [23 * 60 * 60_000, "23 hours"],
    [DAY, "1 day"],
    [20 * DAY, "20 days"],
    [20 * DAY + 23 * 60 * 60_000, "20 days"],
  ])("formats %dms as %s", (ms, expected) => {
    expect(formatRemainingLong("en-US", ms)).toBe(expected);
  });
});
