import { InputSignal, Type } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type CipherViewBanner = Type<{ cipher: InputSignal<CipherView> }>;

/**
 * Optional banner rendered above the cipher details, with the `cipher` as its only input.
 * Hosts that surface privileged access provide the component class, so `libs/vault` needs no
 * dependency on that feature library. Unprovided, nothing renders.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<CipherViewBanner>("CipherViewBanner");
