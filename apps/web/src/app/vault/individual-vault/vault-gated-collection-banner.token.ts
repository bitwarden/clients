import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional notice rendered above the vault's item list while a single collection is the active
 * filter. A host that surfaces a privileged-access feature provides the component class;
 * `app-vault` mounts it via `NgComponentOutlet`, passing the selected collection's
 * `organizationId` and `collectionId`. Whether that collection warrants a notice — and whether
 * its organization has the feature at all — is entirely the provided component's decision, so the
 * vault never depends on the feature library that implements it. Unprovided, the vault is
 * unchanged.
 */
export const VAULT_GATED_COLLECTION_BANNER = new SafeInjectionToken<Type<unknown>>(
  "VaultGatedCollectionBanner",
);
