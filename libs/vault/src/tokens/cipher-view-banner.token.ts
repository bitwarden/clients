import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional banner below the cipher view's item details, provided by a privileged-access host as a
 * component class. `NgComponentOutlet` renders it with `cipher` as its one input.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<Type<unknown>>("CipherViewBanner");
