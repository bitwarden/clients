import { Observable } from "rxjs";

import { Account } from "../abstractions/account.service";

import { AccountSwitcherEntries } from "./account-switcher-entries.type";
import { ActiveAccountResolution } from "./active-account-resolution.type";

/**
 * Decides which accounts the user can switch to, and builds the data an account switcher shows.
 * A logged-out account is never a switch target and never appears in {@link entries$}.
 * Performing the switch and navigating afterward stay with each client.
 */
export abstract class AccountSwitcherService {
  /**
   * The accounts that are not logged out, split into the active account and the others, and
   * whether another account can be added. Emits one value per change, so the active account and
   * the others never disagree, for example during an account switch.
   */
  abstract entries$: Observable<AccountSwitcherEntries>;

  /**
   * Whether another account can be added without exceeding the account limit. Matches
   * `canAddAccount` in {@link entries$}, without reading avatar or server data.
   */
  abstract canAddAccount$: Observable<boolean>;

  /**
   * The most recently active account, other than the active account, that is not logged out.
   * Emits `null` when there is none.
   */
  abstract nextSwitchableAccount$: Observable<Account | null>;

  /**
   * Checks whether the active account can stay active. A logged-out active account must be
   * replaced by {@link nextSwitchableAccount$}, or cleared when no account can replace it.
   */
  abstract resolveActiveAccount(): Promise<ActiveAccountResolution>;
}
