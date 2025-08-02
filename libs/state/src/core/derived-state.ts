import { Observable } from "rxjs";

export type StateConverter<TFrom extends Array<unknown>, TTo> = (...args: TFrom) => TTo;

/**
 * State derived from an observable and a converter function
 *
 * Derived state is cached and persisted to memory for sychronization across execution contexts.
 * For clients with multiple execution contexts, the derived state will be executed only once in the background process.
 */
export interface DerivedState<T> {
  /**
   * The derived state observable
   */
  state$: Observable<T>;
  /**
   * Forces the derived state to a given value.
   *
   * Useful for setting an in-memory value as a side effect of some event, such as emptying state as a result of a lock.
   * @param value The value to force the derived state to
   */
  forceValue(value: T): Promise<T>;
}
