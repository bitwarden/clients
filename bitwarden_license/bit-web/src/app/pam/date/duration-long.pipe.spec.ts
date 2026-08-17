import { TestBed } from "@angular/core/testing";

import { DurationLongPipe } from "./duration-long.pipe";

describe("DurationLongPipe", () => {
  let pipe: DurationLongPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new DurationLongPipe());
  });

  // Assert against Intl.NumberFormat's own output (see duration-short.pipe.spec.ts for the
  // same approach) so this doesn't hardcode ICU's exact long-style wording or pluralization.
  const long = (value: number, unit: "day" | "hour" | "minute" | "second") =>
    new Intl.NumberFormat("en-US", { style: "unit", unit, unitDisplay: "long" }).format(value);

  it("renders whole-day durations in days", () => {
    expect(pipe.transform(24 * 60 * 60)).toBe(long(1, "day"));
    expect(pipe.transform(7 * 24 * 60 * 60)).toBe(long(7, "day"));
  });

  it("renders whole-hour durations in hours", () => {
    expect(pipe.transform(60 * 60)).toBe(long(1, "hour"));
    expect(pipe.transform(4 * 60 * 60)).toBe(long(4, "hour"));
  });

  it("renders whole-minute durations in minutes", () => {
    expect(pipe.transform(15 * 60)).toBe(long(15, "minute"));
  });

  it("falls back to seconds for sub-minute durations", () => {
    expect(pipe.transform(45)).toBe(long(45, "second"));
  });

  it("spells the unit out rather than abbreviating it", () => {
    expect(pipe.transform(60 * 60)).toContain("hour");
    expect(pipe.transform(4 * 60 * 60)).toContain("hours");
  });
});
