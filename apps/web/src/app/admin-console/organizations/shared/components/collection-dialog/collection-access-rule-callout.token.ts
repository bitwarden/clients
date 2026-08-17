import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional callout in the collection edit dialog, naming the privileged-access rule that governs the
 * collection's items.
 *
 * Someone editing a collection's access needs to know that a rule may already be gating it —
 * otherwise the member list looks like the whole story when it is not. The concrete component lives
 * in commercial code (`bitwarden_license/bit-web`) and is bound to this token by `providePam()`; in
 * OSS-only builds the token is unprovided, so the dialog injects `null` and renders no callout.
 *
 * The token holds the component CLASS — the dialog renders it with `NgComponentOutlet`, passing
 * `organizationId` and `collectionId` — so `apps/web` needs no dependency on the feature library.
 */
export const COLLECTION_ACCESS_RULE_CALLOUT = new SafeInjectionToken<Type<unknown>>(
  "CollectionAccessRuleCallout",
);
