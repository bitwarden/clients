import { PamInputError } from "./pam-input-error";
import { validateWindow } from "./pam-window";

const NOW = new Date("2026-03-01T12:00:00Z");
const at = (iso: string) => new Date(iso);

describe("validateWindow", () => {
  it("accepts a window that ends in the future within the maximum", () => {
    const start = at("2026-03-01T12:00:00Z");
    const end = at("2026-03-01T14:00:00Z");

    expect(validateWindow(start, end, { now: NOW })).toEqual({ start, end });
  });

  it("accepts a start in the past while the end is in the future", () => {
    expect(() =>
      validateWindow(at("2026-03-01T10:00:00Z"), at("2026-03-01T13:00:00Z"), { now: NOW }),
    ).not.toThrow();
  });

  it("refuses an end that is not after the start", () => {
    expect(() =>
      validateWindow(at("2026-03-02T00:00:00Z"), at("2026-03-02T00:00:00Z"), { now: NOW }),
    ).toThrow("The end must be after the start.");
    expect(() =>
      validateWindow(at("2026-03-03T00:00:00Z"), at("2026-03-02T00:00:00Z"), { now: NOW }),
    ).toThrow("The end must be after the start.");
  });

  it("refuses an end in the past", () => {
    expect(() =>
      validateWindow(at("2026-02-01T00:00:00Z"), at("2026-02-02T00:00:00Z"), { now: NOW }),
    ).toThrow("The end must be in the future.");
  });

  it("refuses an end exactly now", () => {
    expect(() => validateWindow(at("2026-02-01T00:00:00Z"), NOW, { now: NOW })).toThrow(
      "The end must be in the future.",
    );
  });

  it("checks the end in the future before the length", () => {
    expect(() =>
      validateWindow(at("2020-01-01T00:00:00Z"), at("2025-01-01T00:00:00Z"), { now: NOW }),
    ).toThrow("The end must be in the future.");
  });

  it("refuses a span over the given maximum", () => {
    expect(() =>
      validateWindow(at("2026-03-01T12:00:00Z"), at("2026-03-01T13:00:01Z"), {
        now: NOW,
        maxSeconds: 3600,
      }),
    ).toThrow("cannot be longer than 3600 seconds");
  });

  it("accepts a span exactly at the maximum", () => {
    expect(() =>
      validateWindow(at("2026-03-01T12:00:00Z"), at("2026-03-01T13:00:00Z"), {
        now: NOW,
        maxSeconds: 3600,
      }),
    ).not.toThrow();
  });

  it("defaults the maximum to 365 days", () => {
    expect(() =>
      validateWindow(at("2026-03-01T12:00:00Z"), at("2027-03-02T12:00:01Z"), { now: NOW }),
    ).toThrow(PamInputError);
  });

  it("refuses an invalid date", () => {
    expect(() => validateWindow(new Date("x"), at("2026-03-02T00:00:00Z"), { now: NOW })).toThrow(
      "The end must be after the start.",
    );
  });
});
