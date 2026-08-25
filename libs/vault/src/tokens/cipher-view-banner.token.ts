import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional banner rendered below the cipher's item details, with the `cipher` as its only input.
 * Hosts that surface privileged access provide the component class, so `libs/vault` needs no
 * dependency on that feature library. Unprovided, nothing renders.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<Type<unknown>>("CipherViewBanner");
