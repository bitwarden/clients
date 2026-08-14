import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional badge that surfaces a cipher's privileged-access state in the vault list. A host
 * that surfaces a privileged-access feature provides the badge component class. When it is
 * provided AND the viewer has a PAM-enabled organization in view (`Organization.usePam`),
 * `vault-items` renders a "Controlled access" column and each `vault-cipher-row` renders the
 * badge in that column via `NgComponentOutlet`, passing the row's `cipher`. Otherwise the
 * column is absent and the table is unchanged, so neither `vault-items` nor the rows depend on
 * the feature library that implements the badge.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<Type<unknown>>("VaultRowLeaseBadge");
