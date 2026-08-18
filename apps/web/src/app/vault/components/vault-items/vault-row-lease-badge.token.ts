import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional "Controlled access" badge for a vault row, rendered with the row's `cipher` (or a
 * collection row's `collection`) as its only input. Hosts that surface privileged access provide
 * the component class, so `vault-items` needs no dependency on that feature library. Unprovided,
 * the column is absent.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<Type<unknown>>("VaultRowLeaseBadge");
