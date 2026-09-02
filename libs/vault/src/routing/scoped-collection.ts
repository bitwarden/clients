import { Data, ParamMap } from "@angular/router";

import { MY_ITEMS_ROUTE } from "../models/vault-scope";

/**
 * The route data marking the "My items" route as naming a collection, since its path has no
 * `:collectionId` to carry one — see {@link scopedCollectionSegment}.
 */
export const MY_ITEMS_ROUTE_DATA: Data = { collectionId: MY_ITEMS_ROUTE };

/**
 * The collection segment a vault route names, from wherever that route carries it — the single
 * read `parseVaultScope` and `resolveVaultScope` are fed from, so no caller has to know which of
 * the two vault routes holding a collection it is on.
 *
 * A shared folder drill-in takes the segment as its `:collectionId` param. "My items" cannot: the
 * collection's id differs per member, so its route names it by a static path instead and declares
 * the sentinel in its data — see {@link MY_ITEMS_ROUTE_DATA}.
 *
 * `undefined` arguments are accepted so a caller reading a not-yet-emitted `paramMap` or `data`
 * signal gets the same answer as a route with no collection at all.
 */
export function scopedCollectionSegment(
  params: ParamMap | undefined,
  data: Data | undefined,
): string | null {
  return params?.get("collectionId") ?? (data?.["collectionId"] as string | undefined) ?? null;
}
