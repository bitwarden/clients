import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * A component that offers to share the vault item bound to its `cipher` input, and renders nothing
 * when that item cannot be shared. Everything about sharing — whether it is available, what the
 * control says, and what activating it does — belongs to the implementation.
 *
 * Reached through a token rather than imported so that the Vault layer holds no reference to the
 * sharing feature: `@bitwarden/tools-share` already depends on `@bitwarden/vault` (through
 * `@bitwarden/send-ui`), so importing it back here would close a package cycle. A client that
 * provides no implementation simply shows no share control.
 */
export const SHARE_ITEM_ENTRY_POINT = new SafeInjectionToken<Type<unknown>>(
  "SHARE_ITEM_ENTRY_POINT",
);
