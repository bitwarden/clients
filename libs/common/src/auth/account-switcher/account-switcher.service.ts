import { Observable } from "rxjs";

import { Account } from "../abstractions/account.service";

import { AccountSwitcherEntry } from "./account-switcher-entry.type";
import { ActiveAccountResolution } from "./active-account-resolution.type";

/**
 * Decides which accounts the user can switch to, and builds the data an account switcher shows.
 * A logged-out account is never a switch target and never appears in {@link entries$}.
 * Performing the switch and navigating afterward stay with each client.
 */
export abstract class AccountSwitcherService {
  /**
   * Every account that is not logged out, the active account included, most recently active first.
   */
  abstract entries$: Observable<AccountSwitcherEntry[]>;

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
