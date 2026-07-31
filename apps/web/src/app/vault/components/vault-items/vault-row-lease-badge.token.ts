import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional badge rendered next to a vault row's name, used to surface a gated cipher's
 * access state. A host that surfaces a privileged-access feature provides the badge
 * component class; without it the row renders unchanged.
 *
 * The token holds the component CLASS — `vault-cipher-row` renders it with
 * `NgComponentOutlet`, passing the row's `cipher` — so the row needs no dependency on
 * the feature library that implements the badge.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<Type<unknown>>("VaultRowLeaseBadge");
