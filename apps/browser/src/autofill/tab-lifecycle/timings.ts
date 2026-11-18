import { delayWhen, Observable, of, OperatorFunction, switchMap, take, timer } from "rxjs";

const SETTLE_MS = 500;
const COOL_DOWN_MS = 15_000;
const SLOW_RENDER_DELAY_MS = 1500;
const TRANSITION_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * The tuned durations of the autofill lifecycle, in milliseconds.
 *
 * Each is an observable, such as a setting. A duration is read when its wait is armed, so a change
 * affects the next wait and never one already running. A duration that has no value when its wait
 * is armed holds the wait until it does.
 */
export type AutofillTimings = Readonly<{
  /** How long a tab stays in `WarmUp` before it becomes `Warm` or `Hot`. A focus change restarts it. */
  settleMs$: Observable<number>;
  /** How long a tab stays in `CoolDown` before it becomes `Cold`. */
  coolDownMs$: Observable<number>;
  /** The delay before an absent page-load fill is re-attempted once. */
  slowRenderMs$: Observable<number>;
  /**
   * How long a reported transition stays actionable. Its latest value is read when a report is
   * stamped, and a stored report records the absolute deadline it implies, so the deadline
   * survives a restart.
   */
  transitionMaxAgeMs$: Observable<number>;
}>;

/** The shipped durations. */
export const defaultTimings: AutofillTimings = Object.freeze({
  settleMs$: of(SETTLE_MS),
  coolDownMs$: of(COOL_DOWN_MS),
  slowRenderMs$: of(SLOW_RENDER_DELAY_MS),
  transitionMaxAgeMs$: of(TRANSITION_MAX_AGE_MS),
});

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
