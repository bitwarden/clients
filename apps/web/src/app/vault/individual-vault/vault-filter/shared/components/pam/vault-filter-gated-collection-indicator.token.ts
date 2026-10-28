import { InputSignal, Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

export interface VaultFilterGatedCollectionIndicator {
  readonly collection: InputSignal<{ hasEnabledAccessRule?: boolean } | null>;
}

/**
 * Optional component rendered beside each collection in the Filters sidebar, given the node as its
 * `collection` input. The component decides whether that collection gets an indicator.
 */
export const VAULT_FILTER_GATED_COLLECTION_INDICATOR = new SafeInjectionToken<
  Type<VaultFilterGatedCollectionIndicator>
>("VaultFilterGatedCollectionIndicator");
