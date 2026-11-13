import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { TimestampPipe } from "./timestamp.pipe";

describe("TimestampPipe", () => {
  let pipe: TimestampPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: "en-US" }] });
    pipe = TestBed.runInInjectionContext(() => new TimestampPipe());
  });

  const local = new Date(2026, 10, 4, 15, 45);

  it("formats a Date, an ISO string and epoch milliseconds alike", () => {
    expect(pipe.transform(local)).toBe("Nov 4, 2026, 3:45 PM");
    expect(pipe.transform(local.toISOString())).toBe("Nov 4, 2026, 3:45 PM");
    expect(pipe.transform(local.getTime())).toBe("Nov 4, 2026, 3:45 PM");
  });

  it("adds the seconds when asked", () => {
    expect(pipe.transform(local, "second")).toBe("Nov 4, 2026, 3:45:00 PM");
  });

  it("renders nothing for a missing or unparseable value", () => {
    expect(pipe.transform(null)).toBe("");
    expect(pipe.transform(undefined)).toBe("");
    expect(pipe.transform("not a date")).toBe("");
  });
});
