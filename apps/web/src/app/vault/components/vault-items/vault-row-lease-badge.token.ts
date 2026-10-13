import { InputSignal, Type } from "@angular/core";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type VaultRowLeaseBadge = Type<{ cipher: InputSignal<CipherViewLike | null> }>;

/**
 * Optional "Controlled access" badge for a vault row, rendered with the row's `cipher` as its
 * only input. Hosts that surface privileged access provide the component class, so `vault-items`
 * needs no dependency on that feature library. Unprovided, the column is absent.
 */
export const VAULT_ROW_LEASE_BADGE = new SafeInjectionToken<VaultRowLeaseBadge>(
  "VaultRowLeaseBadge",
);
