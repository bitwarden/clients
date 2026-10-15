import { Signal, Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/** The members the vault side nav uses on an organization options component. */
export interface VaultNavOrganizationOptions {
  /** An input the nav sets to the organization's id. */
  readonly organizationId: Signal<string | undefined>;
}

/**
 * A component the vault side nav renders as each organization's options menu. The nav sets its
 * `organizationId` input to the organization's id. A client that provides no implementation shows
 * no menu.
 */
export const VAULT_NAV_ORGANIZATION_OPTIONS = new SafeInjectionToken<
  Type<VaultNavOrganizationOptions>
>("VAULT_NAV_ORGANIZATION_OPTIONS");
