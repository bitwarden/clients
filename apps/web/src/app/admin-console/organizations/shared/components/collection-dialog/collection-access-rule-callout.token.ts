import { InputSignal, Type } from "@angular/core";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The inputs the collection dialog sets on the callout through `NgComponentOutlet`. Naming them makes
 * a missing or mistyped input a build error rather than a value `NgComponentOutlet` silently drops.
 */
export interface CollectionAccessRuleCallout {
  readonly collection: InputSignal<
    { id: CollectionId; organizationId: OrganizationId; hasEnabledAccessRule?: boolean } | undefined
  >;
}

/**
 * Optional callout in the collection edit dialog flagging a collection whose items an access rule
 * governs. `providePam()` binds the component class for `NgComponentOutlet`; OSS-only builds leave it
 * unprovided and render no callout.
 */
export const COLLECTION_ACCESS_RULE_CALLOUT = new SafeInjectionToken<
  Type<CollectionAccessRuleCallout>
>("CollectionAccessRuleCallout");
