import { TestBed } from "@angular/core/testing";

import { DesktopAccessBadgeTickerService } from "./desktop-access-badge-ticker.service";

describe("DesktopAccessBadgeTickerService", () => {
  const start = new Date("2026-10-16T12:00:00Z").getTime();
  let service: DesktopAccessBadgeTickerService;

  beforeEach(() => {
    // Fakes both `Date.now()` and `performance.now()`; `setSystemTime` moves only the first.
    jest.useFakeTimers({ now: start });
    TestBed.configureTestingModule({ providers: [DesktopAccessBadgeTickerService] });
    service = TestBed.inject(DesktopAccessBadgeTickerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ticks with real time even after the wall clock is set back", () => {
    const next = jest.fn();
    const jumps = jest.fn();
    service.clockJumps$.subscribe(jumps);
    const subscription = service.ticks$.subscribe(next);

    jest.advanceTimersByTime(1_000);
    jest.setSystemTime(Date.now() - 3_600_000);
    jest.advanceTimersByTime(1_000);

    expect(next.mock.calls.map(([ms]) => ms)).toEqual([start + 1_000, start + 2_000]);
    expect(jumps).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });
});
