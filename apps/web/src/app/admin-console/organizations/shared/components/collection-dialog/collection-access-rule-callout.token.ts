import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Injection token for the PAM collection access-rule callout shown in the
 * collection edit dialog.
 *
 * The concrete component lives in commercial code (`bitwarden_license/bit-web`)
 * and is bound to this token by `provide-pam.ts`. In OSS-only builds the token
 * is unprovided, so the dialog renders no callout. The bound component accepts
 * `organizationId` and `collectionId` inputs.
 */
export const COLLECTION_ACCESS_RULE_CALLOUT = new SafeInjectionToken<Type<unknown>>(
  "CollectionAccessRuleCallout",
);
