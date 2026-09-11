import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional badge that surfaces a row's privileged-access state in the vault list. A host
 * provides the badge component class; when provided and the viewer has a PAM-enabled
 * organization in view, `vault-items` renders a "Controlled access" column and each row
 * renders the badge via `NgComponentOutlet`. Otherwise the column is absent and the table is
 * unchanged.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<Type<unknown>>("VaultRowLeaseBadge");
