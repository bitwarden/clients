import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/** Optional action that a gated row renders in place of the copy actions in the popup vault list. */
export const VAULT_ROW_ACCESS_ACTION = new SafeInjectionToken<Type<unknown>>(
  "VaultRowAccessAction",
);
