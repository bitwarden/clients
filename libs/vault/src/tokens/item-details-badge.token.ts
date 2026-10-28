import { InputSignal, Type } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type ItemDetailsBadge = Type<{
  cipher: InputSignal<CipherView>;
  isAdminConsole: InputSignal<boolean>;
}>;

/**
 * Optional badge on the item-details card's name row, right-aligned opposite the name, provided
 * as a component class. `NgComponentOutlet` renders it with `cipher` and `isAdminConsole` as its
 * inputs. The provider decides when it has something to show; the card renders it whenever one is
 * provided.
 *
 * Single token: widen it to `multi` when a second feature contributes a badge.
 */
export const ITEM_DETAILS_BADGE = new SafeInjectionToken<ItemDetailsBadge>("ItemDetailsBadge");
