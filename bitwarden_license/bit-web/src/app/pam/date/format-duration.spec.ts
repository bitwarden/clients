import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  // Assert against Intl.NumberFormat's own output (see duration-short.pipe.spec.ts for the
  // same approach) so this doesn't hardcode ICU's exact wording.
  const expected = (
    value: number,
    unit: "day" | "hour" | "minute" | "second",
    unitDisplay: Intl.NumberFormatOptions["unitDisplay"],
  ) => new Intl.NumberFormat("en-US", { style: "unit", unit, unitDisplay }).format(value);

  it("renders whole-day durations in days", () => {
    expect(formatDuration("en-US", 24 * 60 * 60, "narrow")).toBe(expected(1, "day", "narrow"));
    expect(formatDuration("en-US", 7 * 24 * 60 * 60, "long")).toBe(expected(7, "day", "long"));
  });

  it("renders whole-hour durations in hours", () => {
    expect(formatDuration("en-US", 60 * 60, "narrow")).toBe(expected(1, "hour", "narrow"));
    expect(formatDuration("en-US", 4 * 60 * 60, "long")).toBe(expected(4, "hour", "long"));
  });

  it("renders whole-minute durations in minutes", () => {
    expect(formatDuration("en-US", 15 * 60, "narrow")).toBe(expected(15, "minute", "narrow"));
  });

  it("falls back to seconds for sub-minute durations", () => {
    expect(formatDuration("en-US", 45, "long")).toBe(expected(45, "second", "long"));
  });

  it("keeps the locale and unit display apart in the cache", () => {
    expect(formatDuration("en-US", 60 * 60, "narrow")).not.toBe(
      formatDuration("en-US", 60 * 60, "long"),
    );
    expect(formatDuration("de-DE", 45, "long")).toBe(
      new Intl.NumberFormat("de-DE", {
        style: "unit",
        unit: "second",
        unitDisplay: "long",
      }).format(45),
    );
  });

  it("reuses one Intl.NumberFormat per locale, unit display, and unit", () => {
    const spy = jest.spyOn(Intl, "NumberFormat");
    try {
      formatDuration("fr-FR", 60 * 60, "long");
      formatDuration("fr-FR", 4 * 60 * 60, "long");

      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
