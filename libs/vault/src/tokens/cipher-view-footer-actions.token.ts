import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional footer actions rendered in the dialog footer for the open cipher. A host that
 * surfaces a privileged-access feature provides the footer actions component class through this
 * token; platforms without it leave it unprovided, so the dialog footer renders nothing extra.
 *
 * The token holds the component CLASS, rendered via `NgComponentOutlet` with `cipher` as its
 * one input, so `libs/vault` needs no dependency on the feature library.
 */
export const CIPHER_VIEW_FOOTER_ACTIONS = new SafeInjectionToken<Type<unknown>>(
  "CipherViewFooterActions",
);
