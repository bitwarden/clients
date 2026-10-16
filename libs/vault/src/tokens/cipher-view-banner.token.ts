import { InputSignal, Type } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type CipherViewBanner = Type<{ cipher: InputSignal<CipherView> }>;

/**
 * Optional banner below the cipher view's item details, provided by a privileged-access host as a
 * component class. `NgComponentOutlet` renders it with `cipher` as its one input.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<CipherViewBanner>("CipherViewBanner");
