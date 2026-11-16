import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { CalendarDatePipe } from "./calendar-date.pipe";

describe("CalendarDatePipe", () => {
  let pipe: CalendarDatePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: "en-US" }] });
    pipe = TestBed.runInInjectionContext(() => new CalendarDatePipe());
  });

  it("formats the date alone", () => {
    expect(pipe.transform(new Date(2026, 8, 19, 15, 45).toISOString())).toBe("Sept 19, 2026");
  });

  it("renders nothing for a missing or unparseable value", () => {
    expect(pipe.transform(null)).toBe("");
    expect(pipe.transform("not a date")).toBe("");
  });
});
