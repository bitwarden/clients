import { TestBed } from "@angular/core/testing";

import { DurationShortPipe } from "./duration-short.pipe";

describe("DurationShortPipe", () => {
  let pipe: DurationShortPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new DurationShortPipe());
  });

  // Asserts against Intl.NumberFormat's own output, so this doesn't hardcode ICU's narrow wording.
  const narrow = (value: number, unit: "day" | "hour" | "minute" | "second") =>
    new Intl.NumberFormat("en-US", { style: "unit", unit, unitDisplay: "narrow" }).format(value);

  it("renders whole-day durations in days", () => {
    expect(pipe.transform(24 * 60 * 60)).toBe(narrow(1, "day"));
    expect(pipe.transform(7 * 24 * 60 * 60)).toBe(narrow(7, "day"));
  });

  it("renders whole-hour durations in hours", () => {
    expect(pipe.transform(60 * 60)).toBe(narrow(1, "hour"));
    expect(pipe.transform(4 * 60 * 60)).toBe(narrow(4, "hour"));
  });

  it("renders whole-minute durations in minutes", () => {
    expect(pipe.transform(15 * 60)).toBe(narrow(15, "minute"));
  });

  it("falls back to seconds for sub-minute durations", () => {
    expect(pipe.transform(45)).toBe(narrow(45, "second"));
  });
});
