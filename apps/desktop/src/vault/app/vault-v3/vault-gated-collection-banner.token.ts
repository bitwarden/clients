import { InputSignal, Type } from "@angular/core";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The inputs `app-vault-v3` sets on the banner through `NgComponentOutlet`. Naming them makes a
 * missing or mistyped input a build error rather than a value `NgComponentOutlet` silently drops.
 */
export interface VaultGatedCollectionBanner {
  readonly organizationId: InputSignal<OrganizationId | undefined>;
  readonly collectionId: InputSignal<CollectionId | undefined>;
}

/**
 * Optional notice above the vault's item list while a shared folder is the active scope. The
 * provided component decides whether that collection warrants one; unprovided, nothing renders.
 */
export const VAULT_GATED_COLLECTION_BANNER = new SafeInjectionToken<
  Type<VaultGatedCollectionBanner>
>("VaultGatedCollectionBanner");
