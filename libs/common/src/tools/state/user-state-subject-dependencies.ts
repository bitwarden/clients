import { Simplify } from "type-fest";

import { Account } from "../../auth/abstractions/account.service";
import { Dependencies, BoundDependency, WhenDependency } from "../dependencies";

import { SubjectConstraintsDependency } from "./state-constraints-dependency";

/** dependencies accepted by the user state subject */
export type UserStateSubjectDependencies<State, Dependency> = Simplify<
  BoundDependency<"account", Account> &
    Partial<WhenDependency> &
    Partial<Dependencies<Dependency>> &
    Partial<SubjectConstraintsDependency<State>> & {
      /** Compute the next stored value. If this is not set, values
       *  provided to `next` unconditionally override state.
       *  @param current the value stored in state
       *  @param next the value received by the user state subject's `next` member
       *  @param dependencies the latest value from `Dependencies<TCombine>`
       *  @returns the value to store in state
       */
      nextValue?: (current: State, next: State, dependencies?: Dependency) => State;
      /**
       * Compute whether the state should update. If this is not set, values
       * provided to `next` always update the state.
       * @param current the value stored in state
       * @param next the value received by the user state subject's `next` member
       * @param dependencies the latest value from `Dependencies<TCombine>`
       * @returns `true` if the value should be stored, otherwise `false`.
       */
      shouldUpdate?: (value: State, next: State, dependencies?: Dependency) => boolean;
    }
>;
