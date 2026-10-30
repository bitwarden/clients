import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  // A fixed "en" formatter, compared against its own output, so these check the chosen unit
  // without depending on the host locale or ICU's wording.
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always", style: "narrow" });
  const now = Date.parse("2026-05-15T12:00:00Z");

  it("selects seconds for sub-minute deltas", () => {
    expect(formatRelativeTime(now - 30 * 1000, now, formatter)).toBe(
      formatter.format(-30, "second"),
    );
  });

  it("selects minutes for sub-hour deltas", () => {
    expect(formatRelativeTime(now - 5 * 60 * 1000, now, formatter)).toBe(
      formatter.format(-5, "minute"),
    );
  });

  it("selects hours and keeps the future sign", () => {
    expect(formatRelativeTime(now + 2 * 60 * 60 * 1000, now, formatter)).toBe(
      formatter.format(2, "hour"),
    );
  });

  it("rolls up to days for multi-day deltas", () => {
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000, now, formatter)).toBe(
      formatter.format(-3, "day"),
    );
  });
});
