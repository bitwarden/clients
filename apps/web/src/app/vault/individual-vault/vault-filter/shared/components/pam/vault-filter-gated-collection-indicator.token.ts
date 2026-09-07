import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional indicator rendered beside each collection in the Filters sidebar. A host provides
 * the component class; `app-filter-section` mounts it via `NgComponentOutlet` for collection
 * nodes, passing the node as `collection`. Whether a collection warrants an indicator is
 * entirely the provided component's decision. Unprovided, the sidebar is unchanged.
 */
export const VAULT_FILTER_GATED_COLLECTION_INDICATOR = new SafeInjectionToken<Type<unknown>>(
  "VaultFilterGatedCollectionIndicator",
);
