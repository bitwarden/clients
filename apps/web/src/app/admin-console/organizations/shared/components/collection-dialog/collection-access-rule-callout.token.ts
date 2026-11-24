import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional callout in the collection edit dialog flagging a collection whose items an access rule
 * governs. It takes the dialog's collection as its `collection` input. `providePam()` binds the
 * component class for `NgComponentOutlet`; OSS-only builds leave it unprovided and render no callout.
 */
export const COLLECTION_ACCESS_RULE_CALLOUT = new SafeInjectionToken<Type<unknown>>(
  "CollectionAccessRuleCallout",
);
