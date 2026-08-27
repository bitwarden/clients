import { NgZone } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AccessBadgeTickerService } from "./access-badge-ticker.service";

describe("AccessBadgeTickerService", () => {
  let service: AccessBadgeTickerService;
  let runOutsideAngularSpy: jest.SpyInstance;
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setIntervalSpy = jest.spyOn(global, "setInterval");
    clearIntervalSpy = jest.spyOn(global, "clearInterval");

    // Spy on the real NgZone rather than swapping in a full mock: NgZone is wired deeply into
    // Angular's own change-detection scheduler, and a mock replacement breaks TestBed setup.
    runOutsideAngularSpy = jest
      .spyOn(NgZone.prototype, "runOutsideAngular")
      .mockImplementation((fn) => fn());

    TestBed.configureTestingModule({});
    service = TestBed.inject(AccessBadgeTickerService);

    // Angular's own framework setup also calls runOutsideAngular; only count calls made after
    // the service exists, which is what the "outside the zone" assertions care about.
    runOutsideAngularSpy.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("emits once a second to a subscriber", () => {
    const next = jest.fn();
    const subscription = service.ticks$.subscribe(next);

    jest.advanceTimersByTime(3_000);

    expect(next).toHaveBeenCalledTimes(3);
    subscription.unsubscribe();
  });

  it("shares a single interval across multiple observers", () => {
    const first = jest.fn();
    const second = jest.fn();
    const firstSub = service.ticks$.subscribe(first);
    const secondSub = service.ticks$.subscribe(second);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1_000);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0][0]).toBe(second.mock.calls[0][0]);

    firstSub.unsubscribe();
    secondSub.unsubscribe();
  });

  it("creates the interval outside the Angular zone", () => {
    const subscription = service.ticks$.subscribe();

    expect(runOutsideAngularSpy).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it("tears down the interval once the last observer unsubscribes", () => {
    const firstSub = service.ticks$.subscribe();
    const secondSub = service.ticks$.subscribe();

    firstSub.unsubscribe();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    secondSub.unsubscribe();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh interval if a later observer subscribes after teardown", () => {
    const firstSub = service.ticks$.subscribe();
    firstSub.unsubscribe();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    const next = jest.fn();
    const secondSub = service.ticks$.subscribe(next);

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1_000);
    expect(next).toHaveBeenCalledTimes(1);

    secondSub.unsubscribe();
  });
});
