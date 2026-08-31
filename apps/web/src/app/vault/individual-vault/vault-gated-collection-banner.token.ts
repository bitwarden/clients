import { InputSignal, Type } from "@angular/core";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The two inputs `app-vault` sets on the banner through `NgComponentOutlet`. Naming them here is
 * what makes the binding a compile-time contract: a provided component missing an input, or
 * declaring one with a different type, fails the build instead of silently ignoring the value at
 * runtime, where `NgComponentOutlet` would drop it without a word.
 */
export interface VaultGatedCollectionBanner {
  readonly organizationId: InputSignal<OrganizationId | undefined>;
  readonly collectionId: InputSignal<CollectionId | undefined>;
}

/**
 * Optional notice rendered above the vault's item list while a single collection is the active
 * filter. A host that surfaces a privileged-access feature provides the component class;
 * `app-vault` mounts it via `NgComponentOutlet`, passing the selected collection's
 * `organizationId` and `collectionId`. Whether that collection warrants a notice — and whether
 * its organization has the feature at all — is entirely the provided component's decision, so the
 * vault never depends on the feature library that implements it. Unprovided, the vault is
 * unchanged.
 */
export const VAULT_GATED_COLLECTION_BANNER = new SafeInjectionToken<
  Type<VaultGatedCollectionBanner>
>("VaultGatedCollectionBanner");
