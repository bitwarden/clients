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
    expect(formatRemaining(ms)).toBe(expected);
  });
});
