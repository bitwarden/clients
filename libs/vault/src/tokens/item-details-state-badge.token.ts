import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional state badge rendered on the item-details card's NAME ROW, right-aligned opposite the
 * item name. Hosts that surface a privileged-access feature (currently the web vault) provide the
 * badge component class; platforms without it leave the token unprovided, so `item-details-v2`
 * injects `null` and the card renders exactly as it did before.
 *
 * Distinct from {@link CIPHER_VIEW_BANNER}, which carries the access CARD below the details, and
 * from the web vault's own `VAULT_ROW_LEASE_BADGE`, which carries the same pill into the vault
 * LIST. That one cannot be reused here: it lives in `apps/web`, and `libs/vault` may not import an
 * app. Its contract is also list-shaped — it drives a "Controlled access" column and accepts a
 * collection as well as a cipher — where this one is scoped to the open item.
 *
 * The token holds the component CLASS — `item-details-v2` renders it with `NgComponentOutlet`,
 * passing the `cipher` as a single input — so `libs/vault` needs no dependency on the feature
 * library that implements the badge. The card renders for EVERY vault item, so an implementation
 * must render nothing for an item it does not govern.
 */
export const ITEM_DETAILS_STATE_BADGE = new SafeInjectionToken<Type<unknown>>(
  "ItemDetailsStateBadge",
);
