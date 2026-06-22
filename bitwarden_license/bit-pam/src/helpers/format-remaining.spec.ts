import { formatRemaining } from "./format-remaining";

describe("formatRemaining", () => {
  it("returns hours and minutes when the remainder spans hours", () => {
    expect(formatRemaining((2 * 3600 + 5 * 60) * 1000)).toBe("2h 5m");
  });

  it("drops the minutes when they round to zero", () => {
    expect(formatRemaining(2 * 3600 * 1000)).toBe("2h");
  });

  it("returns minutes only when under one hour", () => {
    expect(formatRemaining(47 * 60 * 1000)).toBe("47m");
  });

  it("returns seconds only when under one minute", () => {
    expect(formatRemaining(15 * 1000)).toBe("15s");
  });

  it("returns 0s for a non-positive duration", () => {
    expect(formatRemaining(-60_000)).toBe("0s");
    expect(formatRemaining(0)).toBe("0s");
  });

  it("returns 0s for a non-finite duration", () => {
    expect(formatRemaining(NaN)).toBe("0s");
    expect(formatRemaining(Infinity)).toBe("0s");
  });

  it("rounds up sub-second remainders to be honest in countdown direction", () => {
    expect(formatRemaining(500)).toBe("1s");
  });
});
