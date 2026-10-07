import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * A component the vault side nav renders as each organization's options menu. The nav sets its
 * `organizationId` input to the organization's id. A client that provides no implementation shows
 * no menu.
 */
export const VAULT_NAV_ORGANIZATION_OPTIONS = new SafeInjectionToken<Type<unknown>>(
  "VAULT_NAV_ORGANIZATION_OPTIONS",
);
