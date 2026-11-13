import { parseIsoDate, toIsoUtc } from "./pam-dates";
import { PamInputError } from "./pam-input-error";

describe("parseIsoDate", () => {
  it("reads a date alone as midnight UTC", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01"))).toBe("2026-03-01T00:00:00.000Z");
  });

  it("reads a time with no offset as UTC", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01T09:30"))).toBe("2026-03-01T09:30:00.000Z");
  });

  it("reads Z", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01T09:30:15Z"))).toBe("2026-03-01T09:30:15.000Z");
  });

  it("applies a positive offset", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01T09:30:00+02:00"))).toBe("2026-03-01T07:30:00.000Z");
  });

  it("applies a negative offset", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01T23:30:00-05:00"))).toBe("2026-03-02T04:30:00.000Z");
  });

  it("reads fractional seconds as milliseconds", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01T00:00:00.5Z"))).toBe("2026-03-01T00:00:00.500Z");
  });

  it("accepts a space in place of T", () => {
    expect(toIsoUtc(parseIsoDate("2026-03-01 09:30Z"))).toBe("2026-03-01T09:30:00.000Z");
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2026-03-01T24:00:00Z",
    "2026-03-01T09:60Z",
    "2026-03-01T09:30+24:00",
    "2026-03-01T09:30+02:60",
    "01/03/2026",
    "tomorrow",
    "2026-03-01T09:30:00 UTC",
    "",
    undefined,
    null,
  ])("refuses %p", (text) => {
    expect(() => parseIsoDate(text)).toThrow(PamInputError);
  });

  it("is not affected by the machine's time zone", () => {
    const original = process.env.TZ;
    process.env.TZ = "Pacific/Auckland";
    try {
      expect(toIsoUtc(parseIsoDate("2026-07-01T12:00"))).toBe("2026-07-01T12:00:00.000Z");
    } finally {
      process.env.TZ = original;
    }
  });

  it("names the option in the refusal", () => {
    expect(() => parseIsoDate("x", "--start")).toThrow("not a valid --start");
  });
});
