import type { Observable } from "rxjs";

import type { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import type { UserId } from "@bitwarden/common/types/guid";

import type { AccountEventKind, TabEdgeCause, TabState } from "./enums";

/**
 * A state change the machine has classified. The machine only reports state transitions.
 *
 * Resting states are not guaranteed by the machine. See `lifecycle/design.md`, "States are virtual".
 */
export interface TabEdge {
  /** The state being left */
  from: TabState;
  /** The state being entered; this is not the same as a resting state. */
  to: TabState;
  /** separates changes that share endpoints. */
  cause: TabEdgeCause;
  /**
   * The window's focus as of this change. Authoritative for `Warm` and `Hot`, which are defined by
   * it; elsewhere it carries the last value the machine was told and should not be read as live.
   */
  focused: boolean;
}

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

/** Something that happened to an account; see {@link AccountEventKind}. */
export type AccountEvent =
  | Readonly<{ kind: typeof AccountEventKind.Login; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Unlock; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Lock; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Logout; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Switch; from: UserId | null; to: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Bootstrapped }>;

/** Each account's sign-in status. */
export type AccountStatuses = Record<UserId, AuthenticationStatus>;

/** The accounts as of one observation, and the events that led to it. */
export type AccountReduction = Readonly<{
  statuses: AccountStatuses;
  active: UserId | null;
  events: AccountEvent[];
}>;
