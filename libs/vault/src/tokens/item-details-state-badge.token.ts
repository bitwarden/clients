import { InputSignal, Type } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type ItemDetailsStateBadge = Type<{ cipher: InputSignal<CipherView> }>;

/** Optional state badge on the item-details card's name row, right-aligned opposite the name. */
export const ITEM_DETAILS_STATE_BADGE = new SafeInjectionToken<ItemDetailsStateBadge>(
  "ItemDetailsStateBadge",
);
