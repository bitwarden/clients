import { Data, ParamMap } from "@angular/router";

import { FOLDER_ID_PARAM, parseVaultScope, VaultScope } from "../models/vault-scope";

import { scopedCollectionSegment } from "./scoped-collection";

/**
 * The route param naming the vault a route shows. Absent on the all-items route, which shows them
 * all.
 */
export const VAULT_SCOPE_PARAM = "vaultId";

/**
 * {@link parseVaultScope} for a vault route — the single read of every segment a scope comes from,
 * so no guard or page has to know which route carries which: the `:vaultId` param, the collection
 * segment (see {@link scopedCollectionSegment}), and a folder page's `:folderId`.
 *
 * `undefined` arguments are accepted so a caller reading a not-yet-emitted `paramMap` or `data`
 * signal gets the same answer as a route naming no scope at all.
 */
export function routeVaultScope(
  params: ParamMap | undefined,
  data: Data | undefined,
): VaultScope | null {
  return parseVaultScope(
    params?.get(VAULT_SCOPE_PARAM),
    scopedCollectionSegment(params, data),
    params?.get(FOLDER_ID_PARAM),
  );
}
