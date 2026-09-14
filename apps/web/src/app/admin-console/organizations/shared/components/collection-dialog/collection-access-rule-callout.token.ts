import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional callout in the collection edit dialog, naming the privileged-access rule that
 * governs the collection's items.
 *
 * Someone editing a collection's access needs to know a rule may already be gating it, or the
 * member list looks like the whole story. The concrete component lives in commercial code,
 * bound to this token by `providePam()`; in OSS-only builds it's unprovided, so the dialog
 * renders no callout.
 *
 * The token holds the component CLASS, rendered via `NgComponentOutlet`, so `apps/web` needs no
 * dependency on the feature library.
 */
export const COLLECTION_ACCESS_RULE_CALLOUT = new SafeInjectionToken<Type<unknown>>(
  "CollectionAccessRuleCallout",
);
