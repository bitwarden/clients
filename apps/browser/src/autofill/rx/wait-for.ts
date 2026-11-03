import { delayWhen, Observable, OperatorFunction, switchMap, take, timer } from "rxjs";

/**
 * Delays each value by a duration in milliseconds that arrives as an observable, such as a setting.
 * The duration current when a value arrives is the one it waits. If `ms$` has no value then, the
 * value is held until it has one.
 */
export function waitFor<T>(ms$: Observable<number>): OperatorFunction<T, T>;
/**
 * Delays each value until a moment that arrives as an observable, such as a stored deadline. The
 * moment current when a value arrives is the one it waits for. A moment already past releases the
 * value at once. If `moment$` has no value then, the value is held until it has one.
 */
export function waitFor<T>(moment$: Observable<Date>): OperatorFunction<T, T>;
export function waitFor<T>(due$: Observable<number | Date>): OperatorFunction<T, T> {
  return delayWhen(() =>
    due$.pipe(
      take(1),
      switchMap((due) => timer(due)),
    ),
  );
}
