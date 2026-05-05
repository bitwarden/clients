import { BehaviorSubject, Observable } from "rxjs";

import {
  Constraints,
  DynamicStateConstraints,
  StateConstraints,
  SubjectConstraints,
} from "../types";

// The constraints type shares the properties of the state,
// but never has any members
const EMPTY_CONSTRAINTS = new Proxy<any>(Object.freeze({}), {
  get() {
    return {};
  },
});

/** A constraint that does nothing. */
export class IdentityConstraint<State extends object>
  implements StateConstraints<State>, DynamicStateConstraints<State>
{
  /** Instantiate the identity constraint */
  constructor() {}

  readonly constraints: Readonly<Constraints<State>> = EMPTY_CONSTRAINTS;

  calibrate() {
    return this;
  }

  adjust(state: State) {
    return state;
  }

  fix(state: State) {
    return state;
  }
}

/** Emits a constraint that does not alter the input state. */
export function unconstrained$<State extends object>(): Observable<SubjectConstraints<State>> {
  const identity = new IdentityConstraint<State>();
  const constraints$ = new BehaviorSubject(identity);

  return constraints$;
}
