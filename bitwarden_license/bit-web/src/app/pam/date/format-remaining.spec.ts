import { formatRemaining } from "./format-remaining";

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
