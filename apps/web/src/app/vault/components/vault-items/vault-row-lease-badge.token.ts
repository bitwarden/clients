import { InputSignal, Type } from "@angular/core";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type VaultRowLeaseBadge = Type<{ cipher: InputSignal<CipherViewLike | null> }>;

/**
 * Optional badge showing a row's privileged-access state in the vault list. When a host provides
 * it and an organization in view uses PAM, `vault-items` adds a "Controlled access" column.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<VaultRowLeaseBadge>(
  "VaultRowLeaseBadge",
);
