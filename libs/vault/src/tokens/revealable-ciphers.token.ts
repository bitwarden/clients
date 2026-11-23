import { Observable } from "rxjs";

import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The restricted ciphers a user may reveal now, as the row overflow menu needs them. The
 * implementation lives with the licensed feature; see {@link REVEALABLE_CIPHERS}.
 */
export interface RevealableCiphers {
  /**
   * IDs of the restricted ciphers the user may reveal now, whether or not they are revealed yet.
   * Empty until known and on failure, so the menu fails closed.
   */
  revealable$(userId: UserId): Observable<ReadonlySet<CipherId>>;
}

/**
 * Lets the row menu offer what a reveal allows before the item is revealed, without importing the
 * licensed feature. The action reveals when it runs. A client that provides no implementation
 * offers those actions only for revealed items.
 */
export const REVEALABLE_CIPHERS = new SafeInjectionToken<RevealableCiphers>("REVEALABLE_CIPHERS");
