import { formatRemaining } from "./format-remaining";

describe("formatRemaining", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("returns hours and minutes when the remainder spans hours", () => {
    const notAfter = new Date(now.getTime() + (2 * 3600 + 5 * 60) * 1000);
    expect(formatRemaining(notAfter, now)).toBe("2h 5m");
  });

  it("drops the minutes when they round to zero", () => {
    const notAfter = new Date(now.getTime() + 2 * 3600 * 1000);
    expect(formatRemaining(notAfter, now)).toBe("2h");
  });

  it("returns minutes only when under one hour", () => {
    const notAfter = new Date(now.getTime() + 47 * 60 * 1000);
    expect(formatRemaining(notAfter, now)).toBe("47m");
  });

  it("returns seconds only when under one minute", () => {
    const notAfter = new Date(now.getTime() + 15 * 1000);
    expect(formatRemaining(notAfter, now)).toBe("15s");
  });

  it("returns 0s for an already-expired lease", () => {
    const notAfter = new Date(now.getTime() - 60_000);
    expect(formatRemaining(notAfter, now)).toBe("0s");
  });

  it("returns 0s for an exactly-now lease", () => {
    expect(formatRemaining(now, now)).toBe("0s");
  });

  it("accepts ISO strings for notAfter", () => {
    expect(formatRemaining("2026-01-01T00:30:00Z", now)).toBe("30m");
  });

  it("returns 0s when given an unparseable date string", () => {
    expect(formatRemaining("not-a-date", now)).toBe("0s");
  });
});
