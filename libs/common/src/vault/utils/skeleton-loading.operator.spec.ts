import { BehaviorSubject } from "rxjs";

import { skeletonLoadingDelay } from "./skeleton-loading.operator";

describe("skeletonLoadingDelay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("returns false immediately when starting with false", () => {
    const source$ = new BehaviorSubject<boolean>(false);
    const results: boolean[] = [];

    source$.pipe(skeletonLoadingDelay()).subscribe((value) => results.push(value));

    expect(results).toEqual([false]);
  });

  it("waits 1 second before returning true when starting with true", () => {
    const source$ = new BehaviorSubject<boolean>(true);
    const results: boolean[] = [];

    source$.pipe(skeletonLoadingDelay()).subscribe((value) => results.push(value));

    expect(results).toEqual([]);

    jest.advanceTimersByTime(999);
    expect(results).toEqual([]);

    jest.advanceTimersByTime(1);
    expect(results).toEqual([true]);
  });

  it("cancels if source becomes false before show delay completes", () => {
    const source$ = new BehaviorSubject<boolean>(true);
    const results: boolean[] = [];

    source$.pipe(skeletonLoadingDelay()).subscribe((value) => results.push(value));

    jest.advanceTimersByTime(500);
    source$.next(false);

    expect(results).toEqual([false]);

    jest.advanceTimersByTime(1000);
    expect(results).toEqual([false]);
  });

  it("delays hiding if minimum display time has not elapsed", () => {
    const source$ = new BehaviorSubject<boolean>(true);
    const results: boolean[] = [];

    source$.pipe(skeletonLoadingDelay()).subscribe((value) => results.push(value));

    jest.advanceTimersByTime(1000);
    expect(results).toEqual([true]);

    source$.next(false);

    expect(results).toEqual([true]);

    jest.advanceTimersByTime(1000);
    expect(results).toEqual([true, false]);
  });

  it("handles rapid true->false->true transitions", () => {
    const source$ = new BehaviorSubject<boolean>(true);
    const results: boolean[] = [];

    source$.pipe(skeletonLoadingDelay()).subscribe((value) => results.push(value));

    jest.advanceTimersByTime(500);
    expect(results).toEqual([]);

    source$.next(false);
    expect(results).toEqual([false]);

    source$.next(true);

    jest.advanceTimersByTime(999);
    expect(results).toEqual([false]);

    jest.advanceTimersByTime(1);
    expect(results).toEqual([false, true]);
  });

  it("allows for custom timings", () => {
    const source$ = new BehaviorSubject<boolean>(true);
    const results: boolean[] = [];

    source$.pipe(skeletonLoadingDelay(1000, 2000)).subscribe((value) => results.push(value));

    jest.advanceTimersByTime(1000);
    expect(results).toEqual([true]);

    source$.next(false);

    jest.advanceTimersByTime(1999);
    expect(results).toEqual([true]);

    jest.advanceTimersByTime(1);
    expect(results).toEqual([true, false]);
  });
});
