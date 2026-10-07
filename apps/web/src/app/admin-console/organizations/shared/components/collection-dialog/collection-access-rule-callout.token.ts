import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional callout in the collection edit dialog naming the access rule that governs the
 * collection's items. `providePam()` binds the component class for `NgComponentOutlet`; OSS-only
 * builds leave it unprovided and render no callout.
 */
export const COLLECTION_ACCESS_RULE_CALLOUT = new SafeInjectionToken<Type<unknown>>(
  "CollectionAccessRuleCallout",
);
