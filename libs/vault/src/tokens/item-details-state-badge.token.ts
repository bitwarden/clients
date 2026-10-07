import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/** Optional state badge on the item-details card's name row, right-aligned opposite the name. */
export const ITEM_DETAILS_STATE_BADGE = new SafeInjectionToken<Type<unknown>>(
  "ItemDetailsStateBadge",
);
