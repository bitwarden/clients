import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional state badge rendered on the item-details card's NAME ROW, right-aligned opposite the
 * item name.
 */
export const ITEM_DETAILS_STATE_BADGE = new SafeInjectionToken<Type<unknown>>(
  "ItemDetailsStateBadge",
);
