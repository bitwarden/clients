import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Injection token for the PAM vault-row lease badge rendered in the vault item
 * list rows.
 *
 * The concrete component lives in commercial code (`bitwarden_license/bit-web`)
 * and is bound to this token by `provide-pam.ts`. In OSS-only builds the token
 * is unprovided, so the row renders no badge. The bound component accepts a
 * `cipher` input.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<Type<unknown>>("VaultRowLeaseBadge");
