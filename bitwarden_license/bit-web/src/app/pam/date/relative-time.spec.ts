import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  // Fixed "en" formatter so assertions don't depend on the host locale. We assert
  // against the formatter's own output to validate which unit/value our code
  // selects, without hardcoding ICU's exact narrow-style wording.
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
