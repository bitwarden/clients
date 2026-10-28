import { InputSignal, Type } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type CipherViewBanner = Type<{
  cipher: InputSignal<CipherView>;
  isAdminConsole: InputSignal<boolean>;
}>;

/**
 * Optional banner below the cipher view's item details, provided as a component class. The cipher
 * view owns the position. `NgComponentOutlet` renders it with `cipher` and `isAdminConsole` as its
 * inputs. The provider decides when it has something to show; the view renders it whenever one is
 * provided.
 *
 * Single token: widen it to `multi` when a second feature contributes a banner.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<CipherViewBanner>("CipherViewBanner");
