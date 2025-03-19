import { Observable } from "rxjs";

import { DynamicStateConstraints, StateConstraints, SubjectConstraints } from "../types";

/** A pattern for types that depend upon a dynamic set of constraints.
 *
 * Consumers of this dependency should track the last-received state and
 * apply it when application state is received or emitted. If `constraints$`
 * emits an unrecoverable error, the consumer should continue using the
 * last-emitted constraints. If `constraints$` completes, the consumer should
 * continue using the last-emitted constraints.
 */
export type SubjectConstraintsDependency<State> = {
  /** A stream that emits constraints when subscribed and when the
   *  constraints change. The stream should not emit `null` or
   *  `undefined`.
   */
  constraints$: Observable<SubjectConstraints<State>>;
};

/** Returns `true` if the input constraint is a `DynamicStateConstraints<T>`.
 *  Otherwise, returns false.
 *  @param constraints the constraint to evaluate.
 * */
export function isDynamic<State>(
  constraints: StateConstraints<State> | DynamicStateConstraints<State>,
): constraints is DynamicStateConstraints<State> {
  return constraints && "calibrate" in constraints;
}
