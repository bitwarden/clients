import { combineLatest, concatMap, from, Observable, scan } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";

import { reduceAccounts } from "./account-events";
import type { AccountEvent, AccountReduction, AccountStatuses } from "./types";

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
 * @param authAccountStatuses$ Each account's status, as from `AuthService.authAccountStatuses$`.
 */
export function accountEvents$(
  activeAccount$: Observable<Account | null>,
  authAccountStatuses$: Observable<AccountStatuses>,
): Observable<AccountEvent> {
  return combineLatest([activeAccount$.pipe(getOptionalUserId), authAccountStatuses$]).pipe(
    scan(
      (previous: AccountReduction | undefined, [activeUserId, statuses]) =>
        reduceAccounts(previous, activeUserId, statuses),
      undefined,
    ),
    concatMap((reduction) => from(reduction!.events)),
  );
}
