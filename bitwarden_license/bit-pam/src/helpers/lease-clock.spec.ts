import { LeaseClock } from "./lease-clock";

describe("LeaseClock", () => {
  const START = Date.parse("2026-01-01T15:00:00.000Z");
  const HOUR = 3_600_000;

  let wall: number;
  let monotonic: number;
  let clock: LeaseClock;
  let jumps: number;

  /** Lets `ms` of real time pass on both clocks. */
  const pass = (ms: number) => {
    wall += ms;
    monotonic += ms;
  };

  beforeEach(() => {
    wall = START;
    monotonic = 1_000;
    clock = new LeaseClock({ wallMs: () => wall, monotonicMs: () => monotonic }, 2_000);
    jumps = 0;
    clock.jumps$.subscribe(() => jumps++);
  });

  it("follows the wall clock while both clocks agree", () => {
    pass(5_000);
    expect(clock.now()).toBe(START + 5_000);

    // Within tolerance, e.g. NTP slewing.
    wall += 500;
    pass(1_000);
    expect(clock.now()).toBe(START + 6_500);
    expect(jumps).toBe(0);
  });

  it("keeps real time when the wall clock is set back", () => {
    pass(10_000);
    wall -= HOUR;

    expect(clock.now()).toBe(START + 10_000);
    expect(jumps).toBe(1);

    pass(5_000);
    expect(clock.now()).toBe(START + 15_000);
    expect(jumps).toBe(1);
  });

  it("follows the wall clock forward", () => {
    wall += HOUR;

    expect(clock.now()).toBe(START + HOUR);
    expect(jumps).toBe(1);
  });

  it("counts a sleep the monotonic clock did not", () => {
    wall += 8 * HOUR;
    monotonic += 10;

    expect(clock.now()).toBe(START + 8 * HOUR);
    expect(jumps).toBe(1);
  });

  it("returns to the wall clock once a set-back clock is corrected", () => {
    wall -= HOUR;
    clock.now();
    pass(10_000);
    wall += HOUR;

    expect(clock.now()).toBe(START + 10_000);
    expect(jumps).toBe(2);
  });

  it("never runs backwards", () => {
    wall -= 1_500;

    expect(clock.now()).toBe(START);
    expect(jumps).toBe(0);
  });
});
