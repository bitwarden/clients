import { map, Observable, OperatorFunction, Subscription } from "rxjs";

/**
 * An rxjs operator that extracts an object by ID from an array of objects.
 * @param id The ID of the object to return.
 * @returns The first object with a matching ID, or undefined if no matching object is present.
 */
export const getById = <TId, T extends { id: TId }>(id: TId) =>
  map<T[], T | undefined>((objects) => objects.find((o) => o.id === id));

/**
 * An rxjs operator that extracts a subset of objects by their IDs from an array of objects.
 * @param id The IDs of the objects to return.
 * @returns An array containing objects with matching IDs, or an empty array if there are no matching objects.
 */
export const getByIds = <TId, T extends { id: TId }>(ids: TId[]) => {
  const idSet = new Set(ids);
  return map<T[], T[]>((objects) => {
    return objects.filter((o) => o.id && idSet.has(o.id));
  });
};

/**
 * A merge-like operator that takes a Set of primitives and tracks if they've been
 * seen before.
 *
 * An emitted set that looks like `["1", "2"]` will call selector and subscribe to the resulting
 * observable for both `"1"` and `"2"` but if the next emission contains just `["1"]` then the
 * subscription created for `"2"` will be unsubscribed from and the observable for `"1"` will be
 * left alone. If the following emission a set like `["1", "2", "3"]` then the subscription for
 * `"1"` is still left alone, `"2"` has a selector called for it again, and `"3"` has a selector
 * called for it the first time. If an empty set is emitted then all items are unsubscribed from.
 *
 * Since this operator will keep track of an observable for `n` number of items given to it. It is
 * smartest to only use this on sets that you know will only get so large.
 *
 * *IMPORTANT NOTE*
 * This observable may not be super friendly to very quick emissions/near parallel execution.
 */
export function trackedMerge<T extends PropertyKey, E>(
  selector: (value: T) => Observable<E>,
): OperatorFunction<Set<T>, E> {
  return (source: Observable<Set<T>>) => {
    // Setup a Map to track all inner subscriptions
    const tracked: Map<T, Subscription> = new Map();

    const cleanupTracked = () => {
      for (const [, trackedSub] of tracked.entries()) {
        trackedSub.unsubscribe();
      }
      tracked.clear();
    };

    return new Observable<E>((subscriber) => {
      const sourceSub = source.subscribe({
        next: (values) => {
          // Loop through the subscriptions we are tracking, if the new list
          // doesn't have any of those values, we should clean them up.
          for (const value of tracked.keys()) {
            if (!values.has(value)) {
              // Tracked item is no longer in the list, cleanup
              tracked.get(value)?.unsubscribe();
              tracked.delete(value);
              continue;
            }

            // We are already tracking something for this key, remove it
            values.delete(value);
          }

          for (const newKey of values.keys()) {
            // These are new entries, create and track subscription for them
            tracked.set(
              newKey,
              /* eslint-disable-next-line rxjs/no-nested-subscribe */
              selector(newKey).subscribe({
                next: (innerValue) => {
                  subscriber.next(innerValue);
                },
                error: (err: unknown) => {
                  // TODO: Do I need to call cleanupTracked or will calling error run my teardown logic below?
                  subscriber.error(err);
                },
                complete: () => {
                  tracked.delete(newKey);
                },
              }),
            );
          }
        },
        error: (err: unknown) => {
          // TODO: Do I need to call cleanupTracked or will calling error run my teardown logic below?
          subscriber.error(err);
        },
        complete: () => {
          // TODO: Do I need to call cleanupTracked or will calling complete run my teardown logic below?
          cleanupTracked();
          subscriber.complete();
        },
      });

      return () => {
        cleanupTracked();
        sourceSub.unsubscribe();
      };
    });
  };
}

/**
 * A type guard that returns true if the value is not nullish.
 * Used for filtering nullish values from observable streams.
 * @example someObservable$.pipe(filter(isNotNullish));
 */
export const isNotNullish = <T>(val: T | null | undefined): val is T => val != null;
