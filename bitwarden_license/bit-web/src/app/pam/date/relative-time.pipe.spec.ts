import { TestBed } from "@angular/core/testing";

import { RelativeTimePipe } from "./relative-time.pipe";

describe("RelativeTimePipe", () => {
  let pipe: RelativeTimePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new RelativeTimePipe());
  });

  it("formats a past ISO date as a relative phrase", () => {
    // Asserts against the formatter's own output, so this doesn't hardcode ICU's narrow wording.
    const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "always", style: "narrow" });
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    expect(pipe.transform(fiveMinutesAgo)).toBe(formatter.format(-5, "minute"));
  });

  it("returns the empty string for null", () => {
    expect(pipe.transform(null)).toBe("");
  });

  it("returns the empty string for undefined", () => {
    expect(pipe.transform(undefined)).toBe("");
  });

  it("returns the empty string for an unparseable value", () => {
    expect(pipe.transform("not-a-date")).toBe("");
  });
});
