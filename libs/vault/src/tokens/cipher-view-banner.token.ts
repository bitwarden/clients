import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional banner rendered directly below the cipher view's item details. A host that surfaces
 * a privileged-access feature provides the banner component class through this token;
 * platforms without it leave it unprovided, so the cipher view renders nothing.
 *
 * The token holds the component CLASS, rendered via `NgComponentOutlet` with `cipher` as its
 * one input, so `libs/vault` needs no dependency on the feature library.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<Type<unknown>>("CipherViewBanner");
