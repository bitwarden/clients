import { TestBed } from "@angular/core/testing";

import { DurationCompoundPipe } from "./duration-compound.pipe";

describe("DurationCompoundPipe", () => {
  let pipe: DurationCompoundPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new DurationCompoundPipe());
  });

  it("names a whole unit the way the single-unit pipe would", () => {
    expect(pipe.transform(2 * 60 * 60)).toBe("2 hours");
    expect(pipe.transform(3 * 24 * 60 * 60)).toBe("3 days");
    expect(pipe.transform(60 * 60)).toBe("1 hour");
  });

  it("rolls a ragged span up to the minute instead of spelling out seconds", () => {
    expect(pipe.transform(943.23)).toBe("16 minutes");
    expect(pipe.transform(943.23)).not.toContain("second");
  });

  it("carries the remainder into a second unit rather than rounding it away", () => {
    expect(pipe.transform(2 * 60 * 60 + 5 * 60)).toBe("2 hours, 5 minutes");
  });
});
