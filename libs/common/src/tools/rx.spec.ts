/**
 * include structuredClone in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */
// @ts-strict-ignore this file explicitly tests what happens when types are ignored
import { of, firstValueFrom, Subject, tap, EmptyError, BehaviorSubject } from "rxjs";

import { awaitAsync, trackEmissions } from "../../spec";

import {
  anyComplete,
  errorOnChange,
  distinctIfShallowMatch,
  on,
  ready,
  reduceCollection,
  withLatestReady,
  pin,
  memoizedMap,
} from "./rx";

describe("tools rx utilites", () => {
  describe("errorOnChange", () => {
    it("emits a single value when the input emits only once", async () => {
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(errorOnChange()).subscribe((v) => results.push(v));

      source$.next(1);

      expect(results).toEqual([1]);
    });

    it("emits when the input emits", async () => {
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(errorOnChange()).subscribe((v) => results.push(v));

      source$.next(1);
      source$.next(1);

      expect(results).toEqual([1, 1]);
    });

    it("errors when the input errors", async () => {
      const source$ = new Subject<number>();
      const expected = {};
      let error: any = null;
      source$.pipe(errorOnChange()).subscribe({ error: (v: unknown) => (error = v) });

      source$.error(expected);

      expect(error).toBe(expected);
    });

    it("completes when the input completes", async () => {
      const source$ = new Subject<number>();
      let complete: boolean = false;
      source$.pipe(errorOnChange()).subscribe({ complete: () => (complete = true) });

      source$.complete();

      expect(complete).toBe(true);
    });

    it("errors when the input changes", async () => {
      const source$ = new Subject<number>();
      let error: any = null;
      source$.pipe(errorOnChange()).subscribe({ error: (v: unknown) => (error = v) });

      source$.next(1);
      source$.next(2);

      expect(error).toEqual({ expectedValue: 1, actualValue: 2 });
    });

    it("emits when the extracted value remains constant", async () => {
      type Foo = { foo: string };
      const source$ = new Subject<Foo>();
      const results: Foo[] = [];
      source$.pipe(errorOnChange((v) => v.foo)).subscribe((v) => results.push(v));

      source$.next({ foo: "bar" });
      source$.next({ foo: "bar" });

      expect(results).toEqual([{ foo: "bar" }, { foo: "bar" }]);
    });

    it("errors when an extracted value changes", async () => {
      type Foo = { foo: string };
      const source$ = new Subject<Foo>();
      let error: any = null;
      source$.pipe(errorOnChange((v) => v.foo)).subscribe({ error: (v: unknown) => (error = v) });

      source$.next({ foo: "bar" });
      source$.next({ foo: "baz" });

      expect(error).toEqual({ expectedValue: "bar", actualValue: "baz" });
    });

    it("constructs an error when the extracted value changes", async () => {
      type Foo = { foo: string };
      const source$ = new Subject<Foo>();
      let error: any = null;
      source$
        .pipe(
          errorOnChange(
            (v) => v.foo,
            (expected, actual) => ({ expected, actual }),
          ),
        )
        .subscribe({ error: (v: unknown) => (error = v) });

      source$.next({ foo: "bar" });
      source$.next({ foo: "baz" });

      expect(error).toEqual({ expected: "bar", actual: "baz" });
    });
  });

  describe("reduceCollection", () => {
    it.each([[null], [undefined], [[]]])(
      "should return the default value when the collection is %p",
      async (value: number[]) => {
        const reduce = (acc: number, value: number) => acc + value;
        const source$ = of(value);

        const result$ = source$.pipe(reduceCollection(reduce, 100));
        const result = await firstValueFrom(result$);

        expect(result).toEqual(100);
      },
    );

    it("should reduce the collection to a single value", async () => {
      const reduce = (acc: number, value: number) => acc + value;
      const source$ = of([1, 2, 3]);

      const result$ = source$.pipe(reduceCollection(reduce, 0));
      const result = await firstValueFrom(result$);

      expect(result).toEqual(6);
    });
  });

  describe("distinctIfShallowMatch", () => {
    it("emits a single value", async () => {
      const source$ = of({ foo: true });
      const pipe$ = source$.pipe(distinctIfShallowMatch());

      const result = trackEmissions(pipe$);
      await awaitAsync();

      expect(result).toEqual([{ foo: true }]);
    });

    it("emits different values", async () => {
      const source$ = of({ foo: true }, { foo: false });
      const pipe$ = source$.pipe(distinctIfShallowMatch());

      const result = trackEmissions(pipe$);
      await awaitAsync();

      expect(result).toEqual([{ foo: true }, { foo: false }]);
    });

    it("emits new keys", async () => {
      const source$ = of({ foo: true }, { foo: true, bar: true });
      const pipe$ = source$.pipe(distinctIfShallowMatch());

      const result = trackEmissions(pipe$);
      await awaitAsync();

      expect(result).toEqual([{ foo: true }, { foo: true, bar: true }]);
    });

    it("suppresses identical values", async () => {
      const source$ = of({ foo: true }, { foo: true });
      const pipe$ = source$.pipe(distinctIfShallowMatch());

      const result = trackEmissions(pipe$);
      await awaitAsync();

      expect(result).toEqual([{ foo: true }]);
    });

    it("suppresses removed keys", async () => {
      const source$ = of({ foo: true, bar: true }, { foo: true });
      const pipe$ = source$.pipe(distinctIfShallowMatch());

      const result = trackEmissions(pipe$);
      await awaitAsync();

      expect(result).toEqual([{ foo: true, bar: true }]);
    });
  });

  describe("anyComplete", () => {
    it("emits true when its input completes", () => {
      const input$ = new Subject<void>();

      const emissions: boolean[] = [];
      anyComplete(input$).subscribe((e) => emissions.push(e));
      input$.complete();

      expect(emissions).toEqual([true]);
    });

    it("completes when its input is already complete", () => {
      const input = new Subject<void>();
      input.complete();

      let completed = false;
      anyComplete(input).subscribe({ complete: () => (completed = true) });

      expect(completed).toBe(true);
    });

    it("completes when any input completes", () => {
      const input$ = new Subject<void>();
      const completing$ = new Subject<void>();

      let completed = false;
      anyComplete([input$, completing$]).subscribe({ complete: () => (completed = true) });
      completing$.complete();

      expect(completed).toBe(true);
    });

    it("ignores emissions", () => {
      const input$ = new Subject<number>();

      const emissions: boolean[] = [];
      anyComplete(input$).subscribe((e) => emissions.push(e));
      input$.next(1);
      input$.next(2);
      input$.complete();

      expect(emissions).toEqual([true]);
    });

    it("forwards errors", () => {
      const input$ = new Subject<void>();
      const expected = { some: "error" };

      let error = null;
      anyComplete(input$).subscribe({ error: (e: unknown) => (error = e) });
      input$.error(expected);

      expect(error).toEqual(expected);
    });
  });

  describe("ready", () => {
    it("connects when subscribed", () => {
      const watch$ = new Subject<void>();
      let connected = false;
      const source$ = new Subject<number>().pipe(tap({ subscribe: () => (connected = true) }));

      // precondition: ready$ should be cold
      const ready$ = source$.pipe(ready(watch$));
      expect(connected).toBe(false);

      ready$.subscribe();

      expect(connected).toBe(true);
    });

    it("suppresses source emissions until its watch emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      const results: number[] = [];
      ready$.subscribe((n) => results.push(n));

      // precondition: no emissions
      source$.next(1);
      expect(results).toEqual([]);

      watch$.next();

      expect(results).toEqual([1]);
    });

    it("suppresses source emissions until all watches emit", () => {
      const watchA$ = new Subject<void>();
      const watchB$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready([watchA$, watchB$]));
      const results: number[] = [];
      ready$.subscribe((n) => results.push(n));

      // preconditions: no emissions
      source$.next(1);
      expect(results).toEqual([]);
      watchA$.next();
      expect(results).toEqual([]);

      watchB$.next();

      expect(results).toEqual([1]);
    });

    it("emits the last source emission when its watch emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      const results: number[] = [];
      ready$.subscribe((n) => results.push(n));

      // precondition: no emissions
      source$.next(1);
      expect(results).toEqual([]);

      source$.next(2);
      watch$.next();

      expect(results).toEqual([2]);
    });

    it("emits all source emissions after its watch emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      const results: number[] = [];
      ready$.subscribe((n) => results.push(n));

      watch$.next();
      source$.next(1);
      source$.next(2);

      expect(results).toEqual([1, 2]);
    });

    it("ignores repeated watch emissions", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      const results: number[] = [];
      ready$.subscribe((n) => results.push(n));

      watch$.next();
      source$.next(1);
      watch$.next();
      source$.next(2);
      watch$.next();

      expect(results).toEqual([1, 2]);
    });

    it("completes when its source completes", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      let completed = false;
      ready$.subscribe({ complete: () => (completed = true) });

      source$.complete();

      expect(completed).toBeTruthy();
    });

    it("errors when its source errors", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      const expected = { some: "error" };
      let error = null;
      ready$.subscribe({ error: (e: unknown) => (error = e) });

      source$.error(expected);

      expect(error).toEqual(expected);
    });

    it("errors when its watch errors", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      const expected = { some: "error" };
      let error = null;
      ready$.subscribe({ error: (e: unknown) => (error = e) });

      watch$.error(expected);

      expect(error).toEqual(expected);
    });

    it("errors when its watch completes before emitting", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(ready(watch$));
      let error = null;
      ready$.subscribe({ error: (e: unknown) => (error = e) });

      watch$.complete();

      expect(error).toBeInstanceOf(EmptyError);
    });
  });

  describe("withLatestReady", () => {
    it("connects when subscribed", () => {
      const watch$ = new Subject<string>();
      let connected = false;
      const source$ = new Subject<number>().pipe(tap({ subscribe: () => (connected = true) }));

      // precondition: ready$ should be cold
      const ready$ = source$.pipe(withLatestReady(watch$));
      expect(connected).toBe(false);

      ready$.subscribe();

      expect(connected).toBe(true);
    });

    it("suppresses source emissions until its watch emits", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      const results: [number, string][] = [];
      ready$.subscribe((n) => results.push(n));

      // precondition: no emissions
      source$.next(1);
      expect(results).toEqual([]);

      watch$.next("watch");

      expect(results).toEqual([[1, "watch"]]);
    });

    it("emits the last source emission when its watch emits", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      const results: [number, string][] = [];
      ready$.subscribe((n) => results.push(n));

      // precondition: no emissions
      source$.next(1);
      expect(results).toEqual([]);

      source$.next(2);
      watch$.next("watch");

      expect(results).toEqual([[2, "watch"]]);
    });

    it("emits all source emissions after its watch emits", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      const results: [number, string][] = [];
      ready$.subscribe((n) => results.push(n));

      watch$.next("watch");
      source$.next(1);
      source$.next(2);

      expect(results).toEqual([
        [1, "watch"],
        [2, "watch"],
      ]);
    });

    it("appends the latest watch emission", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      const results: [number, string][] = [];
      ready$.subscribe((n) => results.push(n));

      watch$.next("ignored");
      watch$.next("watch");
      source$.next(1);
      watch$.next("ignored");
      watch$.next("watch");
      source$.next(2);

      expect(results).toEqual([
        [1, "watch"],
        [2, "watch"],
      ]);
    });

    it("completes when its source completes", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      let completed = false;
      ready$.subscribe({ complete: () => (completed = true) });

      source$.complete();

      expect(completed).toBeTruthy();
    });

    it("errors when its source errors", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      const expected = { some: "error" };
      let error = null;
      ready$.subscribe({ error: (e: unknown) => (error = e) });

      source$.error(expected);

      expect(error).toEqual(expected);
    });

    it("errors when its watch errors", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      const expected = { some: "error" };
      let error = null;
      ready$.subscribe({ error: (e: unknown) => (error = e) });

      watch$.error(expected);

      expect(error).toEqual(expected);
    });

    it("errors when its watch completes before emitting", () => {
      const watch$ = new Subject<string>();
      const source$ = new Subject<number>();
      const ready$ = source$.pipe(withLatestReady(watch$));
      let error = null;
      ready$.subscribe({ error: (e: unknown) => (error = e) });

      watch$.complete();

      expect(error).toBeInstanceOf(EmptyError);
    });
  });

  describe("on", () => {
    it("connects when subscribed", () => {
      const watch$ = new Subject<void>();
      let connected = false;
      const source$ = new Subject<number>().pipe(tap({ subscribe: () => (connected = true) }));

      // precondition: on$ should be cold
      const on$ = source$.pipe(on(watch$));
      expect(connected).toBeFalsy();

      on$.subscribe();

      expect(connected).toBeTruthy();
    });

    it("suppresses source emissions until `on` emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(on(watch$)).subscribe((n) => results.push(n));

      // precondition: on$ should be cold
      source$.next(1);
      expect(results).toEqual([]);

      watch$.next();

      expect(results).toEqual([1]);
    });

    it("repeats source emissions when `on` emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(on(watch$)).subscribe((n) => results.push(n));
      source$.next(1);

      watch$.next();
      watch$.next();

      expect(results).toEqual([1, 1]);
    });

    it("updates source emissions when `on` emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(on(watch$)).subscribe((n) => results.push(n));

      source$.next(1);
      watch$.next();
      source$.next(2);
      watch$.next();

      expect(results).toEqual([1, 2]);
    });

    it("emits a value when `on` emits before the source is ready", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(on(watch$)).subscribe((n) => results.push(n));

      watch$.next();
      source$.next(1);

      expect(results).toEqual([1]);
    });

    it("ignores repeated `on` emissions before the source is ready", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(on(watch$)).subscribe((n) => results.push(n));

      watch$.next();
      watch$.next();
      source$.next(1);

      expect(results).toEqual([1]);
    });

    it("emits only the latest source emission when `on` emits", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const results: number[] = [];
      source$.pipe(on(watch$)).subscribe((n) => results.push(n));
      source$.next(1);

      watch$.next();

      source$.next(2);
      source$.next(3);
      watch$.next();

      expect(results).toEqual([1, 3]);
    });

    it("completes when its source completes", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      let complete: boolean = false;
      source$.pipe(on(watch$)).subscribe({ complete: () => (complete = true) });

      source$.complete();

      expect(complete).toBeTruthy();
    });

    it("completes when its watch completes", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      let complete: boolean = false;
      source$.pipe(on(watch$)).subscribe({ complete: () => (complete = true) });

      watch$.complete();

      expect(complete).toBeTruthy();
    });

    it("errors when its source errors", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const expected = { some: "error" };
      let error = null;
      source$.pipe(on(watch$)).subscribe({ error: (e: unknown) => (error = e) });

      source$.error(expected);

      expect(error).toEqual(expected);
    });

    it("errors when its watch errors", () => {
      const watch$ = new Subject<void>();
      const source$ = new Subject<number>();
      const expected = { some: "error" };
      let error = null;
      source$.pipe(on(watch$)).subscribe({ error: (e: unknown) => (error = e) });

      watch$.error(expected);

      expect(error).toEqual(expected);
    });
  });

  describe("pin", () => {
    it("emits the first value", async () => {
      const input = new Subject<unknown>();
      const result: unknown[] = [];

      input.pipe(pin()).subscribe((v) => result.push(v));
      input.next(1);

      expect(result).toEqual([1]);
    });

    it("filters repeated emissions", async () => {
      const input = new Subject<unknown>();
      const result: unknown[] = [];

      input.pipe(pin({ distinct: (p, c) => p == c })).subscribe((v) => result.push(v));
      input.next(1);
      input.next(1);

      expect(result).toEqual([1]);
    });

    it("errors if multiple emissions occur", async () => {
      const input = new Subject<unknown>();
      let error: any = null!;

      input.pipe(pin()).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      input.next(1);
      input.next(1);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/^unknown/);
    });

    it("names the pinned observables if multiple emissions occur", async () => {
      const input = new Subject<unknown>();
      let error: any = null!;

      input.pipe(pin({ name: () => "example" })).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      input.next(1);
      input.next(1);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/^example/);
    });

    it("errors if indistinct emissions occur", async () => {
      const input = new Subject<unknown>();
      let error: any = null!;

      input
        .pipe(pin({ distinct: (p, c) => p == c }))
        .subscribe({ error: (e: unknown) => (error = e) });
      input.next(1);
      input.next(2);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/^unknown/);
    });
  });

  describe("memoizedMap", () => {
    it("maps a value", () => {
      const source$ = new Subject<string>();
      const result$ = new BehaviorSubject<object>({});
      const expectedResult = {};
      source$.pipe(memoizedMap(() => expectedResult)).subscribe(result$);

      source$.next("foo");

      expect(result$.value).toEqual(expectedResult);
    });

    it("caches a mapped result", () => {
      const source$ = new Subject<string>();
      const result$ = new BehaviorSubject<object>({});
      const map = jest.fn(() => ({}));
      source$.pipe(memoizedMap(map)).subscribe(result$);

      source$.next("foo");
      source$.next("foo");

      expect(map).toHaveBeenCalledTimes(1);
    });

    it("caches the last mapped result", () => {
      const source$ = new Subject<string>();
      const result$ = new BehaviorSubject<object>({});
      const map = jest.fn(() => ({}));
      source$.pipe(memoizedMap(map)).subscribe(result$);

      source$.next("foo");
      source$.next("foo");
      source$.next("bar");
      source$.next("foo");

      expect(map).toHaveBeenCalledTimes(3);
    });

    it("caches multiple mapped results", () => {
      const source$ = new Subject<string>();
      const result$ = new BehaviorSubject<object>({});
      const map = jest.fn(() => ({}));
      source$.pipe(memoizedMap(map, { size: 2 })).subscribe(result$);

      source$.next("foo");
      source$.next("bar");
      source$.next("foo");
      source$.next("bar");

      expect(map).toHaveBeenCalledTimes(2);
    });

    it("caches a result by key", () => {
      const source$ = new Subject<{ key: string }>();
      const result$ = new BehaviorSubject<object>({});
      const map = jest.fn(() => ({}));
      source$.pipe(memoizedMap(map, { key: (s) => s.key })).subscribe(result$);

      // the messages are not equal; the keys are
      source$.next({ key: "foo" });
      source$.next({ key: "foo" });
      source$.next({ key: "bar" });
      source$.next({ key: "bar" });

      expect(map).toHaveBeenCalledTimes(2);
    });
  });

  it("errors", () => {
    const source$ = new Subject<string>();
    let error: unknown = null;
    source$.pipe(memoizedMap(() => {})).subscribe({ error: (e: unknown) => (error = e) });
    const expectedError = {};

    source$.error(expectedError);

    expect(error).toEqual(expectedError);
  });

  it("completes", () => {
    const source$ = new Subject<string>();
    let completed = false;
    source$.pipe(memoizedMap(() => {})).subscribe({ complete: () => (completed = true) });

    source$.complete();

    expect(completed).toEqual(true);
  });
});
