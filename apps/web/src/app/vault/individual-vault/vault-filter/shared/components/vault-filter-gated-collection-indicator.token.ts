import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional indicator rendered beside each collection in the Filters sidebar. A host that
 * surfaces a privileged-access feature provides the component class; `app-filter-section`
 * mounts it via `NgComponentOutlet` for the nodes of the collection section only, passing the
 * node as `collection`. Whether a given collection warrants an indicator — and whether its
 * organization has the feature at all — is entirely the provided component's decision, so the
 * sidebar never depends on the feature library that implements it. Unprovided, the sidebar is
 * unchanged.
 */
export const VAULT_FILTER_GATED_COLLECTION_INDICATOR = new SafeInjectionToken<Type<unknown>>(
  "VaultFilterGatedCollectionIndicator",
);
