import { TestBed } from "@angular/core/testing";

import { DurationLongPipe } from "./duration-long.pipe";

describe("DurationLongPipe", () => {
  let pipe: DurationLongPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new DurationLongPipe());
  });

  // Unit selection is shared with the short pipe and covered by its spec; what is unique
  // here is the spelled-out rendering, so assert on the wording rather than re-deriving
  // Intl.NumberFormat's output.
  it("spells the unit out rather than abbreviating it", () => {
    expect(pipe.transform(60 * 60)).toBe("1 hour");
    expect(pipe.transform(24 * 60 * 60)).toBe("1 day");
  });

  it("pluralizes the spelled-out unit", () => {
    expect(pipe.transform(4 * 60 * 60)).toBe("4 hours");
    expect(pipe.transform(15 * 60)).toBe("15 minutes");
  });
});
