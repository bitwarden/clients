import { combineLatest, concatMap, from, Observable, scan } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";

/** What an {@link AccountEvent} reports. */
export const AccountEventKind = Object.freeze({
  /**
   * The account signed in, whether locked or unlocked. Each account already signed in at the first
   * observation is reported immediately.
   */
  Login: "login",
  /** A signed-in account changed from locked to unlocked. */
  Unlock: "unlock",
  /** A signed-in account changed from unlocked to locked. */
  Lock: "lock",
  /** The account signed out. */
  Logout: "logout",
  /**
   * The active account changed to `to`, which is signed in. `from` is the account the last switch
   * went to, or `null` before the first. A switch to a signed-out account comes right after its
   * login. The active account becoming none emits nothing, so its return to the same account emits
   * nothing either.
   */
  Switch: "switch",
  /** The first observation has been reported: every event before it describes the accounts then. */
  Bootstrapped: "bootstrapped",
} as const);
export type AccountEventKind = (typeof AccountEventKind)[keyof typeof AccountEventKind];

/** Something that happened to an account; see {@link AccountEventKind}. */
export type AccountEvent =
  | Readonly<{ kind: typeof AccountEventKind.Login; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Unlock; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Lock; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Logout; userId: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Switch; from: UserId | null; to: UserId }>
  | Readonly<{ kind: typeof AccountEventKind.Bootstrapped }>;

type Statuses = Record<UserId, AuthenticationStatus>;
type Reduction = Readonly<{ statuses: Statuses; active: UserId | null; events: AccountEvent[] }>;

const { LoggedOut, Locked } = AuthenticationStatus;

/** The events between one observation of the accounts and the next. */
function reduce(
  previous: Reduction | undefined,
  activeUserId: UserId | null,
  statuses: Statuses,
): Reduction {
  const before: Statuses = previous?.statuses ?? {};
  const userIds = new Set([...Object.keys(before), ...Object.keys(statuses)] as UserId[]);

  const logins: AccountEvent[] = [];
  const changes: AccountEvent[] = [];
  for (const userId of userIds) {
    const was = before[userId] ?? LoggedOut;
    const is = statuses[userId] ?? LoggedOut;
    if (was === is) {
      continue;
    }
    if (was === LoggedOut) {
      logins.push({ kind: AccountEventKind.Login, userId });
    } else if (is === LoggedOut) {
      changes.push({ kind: AccountEventKind.Logout, userId });
    } else {
      changes.push({
        kind: is === Locked ? AccountEventKind.Lock : AccountEventKind.Unlock,
        userId,
      });
    }
  }

  // a switch implies the account it goes to is signed in, so one to a signed-out account waits
  // for that account's login
  let active = previous?.active ?? null;
  const switches: AccountEvent[] = [];
  if (
    activeUserId !== null &&
    activeUserId !== active &&
    (statuses[activeUserId] ?? LoggedOut) !== LoggedOut
  ) {
    switches.push({ kind: AccountEventKind.Switch, from: active, to: activeUserId });
    active = activeUserId;
  }

  const events = [...logins, ...switches, ...changes];
  if (previous === undefined) {
    events.push({ kind: AccountEventKind.Bootstrapped });
  }
  return { statuses, active, events };
}

/**
 * The accounts' history as events. The first observation is described as changes from no accounts:
 * a `login` for each signed-in account, a `switch` to the active one if it is signed in, then
 * `bootstrapped`.
 *
 * Within one observation, logins come first, then the switch, then the other changes. The two
 * sources update separately, so changes that happen together can arrive in either order: an
 * active account that signs out as another becomes active emits `logout` then `switch`, or
 * `switch` then `logout`.
 *
 * @param activeAccount$ The active account, as from `AccountService.activeAccount$`.
 * @param authStatuses$ Each account's status, as from `AuthService.authStatuses$`.
 */
export function accountEvents$(
  activeAccount$: Observable<Account | null>,
  authStatuses$: Observable<Statuses>,
): Observable<AccountEvent> {
  return combineLatest([activeAccount$.pipe(getOptionalUserId), authStatuses$]).pipe(
    scan(
      (previous: Reduction | undefined, [activeUserId, statuses]) =>
        reduce(previous, activeUserId, statuses),
      undefined,
    ),
    concatMap((reduction) => from(reduction!.events)),
  );
}
