// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  map,
  distinctUntilChanged,
  OperatorFunction,
  Observable,
  ignoreElements,
  endWith,
  race,
  pipe,
  connect,
  ReplaySubject,
  concat,
  zip,
  first,
  takeUntil,
  withLatestFrom,
  concatMap,
  startWith,
  pairwise,
  MonoTypeOperatorFunction,
  Cons,
  scan,
  filter,
} from "rxjs";

import { ObservableTuple } from "./rx.rxjs";

/** Returns its input. */
function identity(value: any): any {
  return value;
}

/** Combines its arguments into a plain old javascript object. */
function expectedAndActualValue(expectedValue: any, actualValue: any) {
  return {
    expectedValue,
    actualValue,
  };
}

/**
 * An observable operator that throws an error when the stream's
 *   value changes. Uses strict (`===`) comparison checks.
 * @param extract a function that identifies the member to compare;
 *   defaults to the identity function
 * @param error a function that packages the expected and failed
 *   values into an error.
 * @returns a stream of values that emits when the input emits,
 *   completes when the input completes, and errors when either the
 *   input errors or the comparison fails.
 */
export function errorOnChange<Input, Extracted>(
  extract: (value: Input) => Extracted = identity,
  error: (expectedValue: Extracted, actualValue: Extracted) => unknown = expectedAndActualValue,
): OperatorFunction<Input, Input> {
  return pipe(
    startWith(null),
    pairwise(),
    map(([expected, actual], i) => {
      // always let the first value through
      if (i === 0) {
        return actual;
      }

      const expectedValue = extract(expected);
      const actualValue = extract(actual);

      // fail the stream if the state desyncs from its initial value
      if (expectedValue === actualValue) {
        return actual;
      } else {
        throw error(expectedValue, actualValue);
      }
    }),
  );
}

/**
 * An observable operator that reduces an emitted collection to a single object,
 * returning a default if all items are ignored.
 * @param reduce The reduce function to apply to the filtered collection. The
 *  first argument is the accumulator, and the second is the current item. The
 *  return value is the new accumulator.
 * @param defaultValue The default value to return if the collection is empty. The
 *   default value is also the initial value of the accumulator.
 */
export function reduceCollection<Item, Accumulator>(
  reduce: (acc: Accumulator, value: Item) => Accumulator,
  defaultValue: Accumulator,
): OperatorFunction<Item[], Accumulator> {
  return map((values: Item[]) => {
    const reduced = (values ?? []).reduce(reduce, structuredClone(defaultValue));
    return reduced;
  });
}

/**
 * An observable operator that emits distinct values by checking that all
 *   values in the previous entry match the next entry. This method emits
 *   when a key is added and does not when a key is removed.
 * @remarks This method checks objects. It does not check items in arrays.
 */
export function distinctIfShallowMatch<Item>(): OperatorFunction<Item, Item> {
  return distinctUntilChanged((previous, current) => {
    let isDistinct = true;

    for (const key in current) {
      isDistinct &&= previous[key] === current[key];
    }

    return isDistinct;
  });
}

/** Create an observable that, once subscribed, emits `true` then completes when
 *   any input completes. If an input is already complete when the subscription
 *   occurs, it emits immediately.
 *  @param watch$ the observable(s) to watch for completion; if an array is passed,
 *   null and undefined members are ignored. If `watch$` is empty, `anyComplete`
 *   will never complete.
 *  @returns An observable that emits `true` when any of its inputs
 *   complete. The observable forwards the first error from its input.
 *  @remarks This method is particularly useful in combination with `takeUntil` and
 *   streams that are not guaranteed to complete on their own.
 */
export function anyComplete(watch$: Observable<any> | Observable<any>[]): Observable<any> {
  if (Array.isArray(watch$)) {
    const completes$ = watch$
      .filter((w$) => !!w$)
      .map((w$) => w$.pipe(ignoreElements(), endWith(true)));
    const completed$ = race(completes$);
    return completed$;
  } else {
    return watch$.pipe(ignoreElements(), endWith(true));
  }
}

/**
 * Create an observable that delays the input stream until all watches have
 *  emitted a value. The watched values are not included in the source stream.
 *  The last emission from the source is output when all the watches have
 *  emitted at least once.
 * @param watch$ the observable(s) to watch for readiness. If `watch$` is empty,
 *  `ready` will never emit.
 * @returns An observable that emits when the source stream emits. The observable
 *   errors if one of its watches completes before emitting. It also errors if one
 *   of its watches errors.
 */
export function ready<T>(watch$: Observable<any> | Observable<any>[]) {
  const watching$ = Array.isArray(watch$) ? watch$ : [watch$];
  return pipe(
    connect<T, Observable<T>>((source$) => {
      // this subscription is safe because `source$` connects only after there
      // is an external subscriber.
      const source = new ReplaySubject<T>(1);
      source$.subscribe(source);

      // `concat` is subscribed immediately after it's returned, at which point
      // `zip` blocks until all items in `watching$` are ready. If that occurs
      // after `source$` is hot, then the replay subject sends the last-captured
      // emission through immediately. Otherwise, `ready` waits for the next
      // emission
      return concat(zip(watching$).pipe(first(), ignoreElements()), source).pipe(
        takeUntil(anyComplete(source)),
      );
    }),
  );
}

export function withLatestReady<Source, Watch extends readonly unknown[]>(
  ...watches$: [...ObservableTuple<Watch>]
): OperatorFunction<Source, Cons<Source, Watch>> {
  return connect((source$) => {
    // these subscriptions are safe because `source$` connects only after there
    // is an external subscriber.
    const source = new ReplaySubject<Source>(1);
    source$.subscribe(source);

    const watches = watches$.map((w) => {
      const watch$ = new ReplaySubject<unknown>(1);
      w.subscribe(watch$);
      return watch$;
    }) as [...ObservableTuple<Watch>];

    // `concat` is subscribed immediately after it's returned, at which point
    // `zip` blocks until all items in `watches` are ready. If that occurs
    // after `source$` is hot, then the replay subject sends the last-captured
    // emission through immediately. Otherwise, `withLatestFrom` waits for the
    // next emission
    return concat(zip(watches).pipe(first(), ignoreElements()), source).pipe(
      withLatestFrom(...watches),
      takeUntil(anyComplete(source)),
    ) as Observable<Cons<Source, Watch>>;
  });
}

/**
 * Create an observable that emits the latest value of the source stream
 *  when `watch$` emits. If `watch$` emits before the stream emits, then
 *  an emission occurs as soon as a value becomes ready.
 * @param watch$ the observable that triggers emissions
 * @returns An observable that emits when `watch$` emits. The observable
 *  errors if its source stream errors. It also errors if `on` errors. It
 *  completes if its watch completes.
 *
 * @remarks This works like `audit`, but it repeats emissions when
 *  watch$ fires.
 */
export function on<T>(watch$: Observable<any>) {
  return pipe(
    connect<T, Observable<T>>((source$) => {
      const source = new ReplaySubject<T>(1);
      source$.subscribe(source);

      return watch$
        .pipe(
          ready(source),
          concatMap(() => source.pipe(first())),
        )
        .pipe(takeUntil(anyComplete(source)));
    }),
  );
}

/** Create an observable that emits the first value from the source and
 *  throws if the observable emits another value.
 *  @param options.name names the pin to make discovering failing observables easier
 *  @param options.distinct compares two emissions with each other to determine whether
 *   the second emission is a duplicate. When this is specified, duplicates are ignored.
 *   When this isn't specified, any emission after the first causes the pin to throw
 *   an error.
 */
export function pin<T>(options?: {
  name?: () => string;
  distinct?: (previous: T, current: T) => boolean;
}): MonoTypeOperatorFunction<T> {
  return pipe(
    options?.distinct ? distinctUntilChanged(options.distinct) : (i) => i,
    map((value, index) => {
      if (index > 0) {
        throw new Error(`${options?.name?.() ?? "unknown"} observable should only emit one value.`);
      } else {
        return value;
      }
    }),
  );
}

/** maps a value to a result and keeps a cache of the mapping
 *  @param mapResult - maps the stream to a result; this function must return
 *    a value. It must not return null or undefined.
 *  @param options.size - the number of entries in the cache
 *  @param options.key - maps the source to a cache key
 *  @remarks this method is useful for optimization of expensive
 *    `mapResult` calls. It's also useful when an interned reference type
 *    is needed.
 */
export function memoizedMap<Source, Result extends NonNullable<any>>(
  mapResult: (source: Source) => Result,
  options?: { size?: number; key?: (source: Source) => unknown },
): OperatorFunction<Source, Result> {
  return pipe(
    // scan's accumulator contains the cache
    scan(
      ([cache], source) => {
        const key: unknown = options?.key?.(source) ?? source;

        // cache hit?
        let result = cache?.get(key);
        if (result) {
          return [cache, result] as const;
        }

        // cache miss
        result = mapResult(source);
        cache?.set(key, result);

        // trim cache
        const overage = cache.size - (options?.size ?? 1);
        if (overage > 0) {
          Array.from(cache?.keys() ?? [])
            .slice(0, overage)
            .forEach((k) => cache?.delete(k));
        }

        return [cache, result] as const;
      },
      // FIXME: upgrade to a least-recently-used cache
      [new Map(), null] as [Map<unknown, Result>, Source | null],
    ),

    // encapsulate cache
    map(([, result]) => result),

    // preserve `NonNullable` constraint on `Result`
    filter((result): result is Result => !!result),
  );
}
