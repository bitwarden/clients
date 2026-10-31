import { ActivatedRoute, NavigationExtras, Params, Router } from "@angular/router";

import { CollectionId, isId, OrganizationId } from "@bitwarden/common/types/guid";

/** Where an organization import was started from, for the result dialog's return button. */
export const IMPORT_RETURN_TO_PARAM = "returnTo";

/** The vault the import was started from, so the location step can start on it. */
export const IMPORT_DEFAULT_ORGANIZATION_PARAM = "defaultOrganizationId";
export const IMPORT_DEFAULT_COLLECTION_PARAM = "defaultCollectionId";

/** The page the import was started from, so it ends there as the legacy import's dialog did. */
export const IMPORT_STARTED_FROM_PARAM = "startedFrom";

/** The pages `startedFrom` names besides a personal folder, which it names by id. */
export const ImportStartedFrom = Object.freeze({
  MyVault: "my-vault",
  Trash: "trash",
  Archive: "archive",
  MyItems: "my-items",
} as const);
export type ImportStartedFrom = (typeof ImportStartedFrom)[keyof typeof ImportStartedFrom];

const CARRIED_PARAMS = [
  IMPORT_RETURN_TO_PARAM,
  IMPORT_DEFAULT_ORGANIZATION_PARAM,
  IMPORT_DEFAULT_COLLECTION_PARAM,
  IMPORT_STARTED_FROM_PARAM,
] as const;

export interface ImportScope {
  defaultOrganizationId?: OrganizationId;
  defaultCollectionId?: CollectionId;
}

/** The vault scope in the URL. It is untrusted input, so anything that isn't an id is dropped; the
 *  location step also only ever matches it against the options it was given. */
export function importScopeFromQuery(route: ActivatedRoute): ImportScope {
  const organizationId = route.snapshot.queryParamMap.get(IMPORT_DEFAULT_ORGANIZATION_PARAM);
  const collectionId = route.snapshot.queryParamMap.get(IMPORT_DEFAULT_COLLECTION_PARAM);
  return {
    defaultOrganizationId: isId<OrganizationId>(organizationId) ? organizationId : undefined,
    defaultCollectionId: isId<CollectionId>(collectionId) ? collectionId : undefined,
  };
}

/** The page in the URL the import was started from: a fixed name or a personal folder's id.
 *  Untrusted input like the scope, so anything else is dropped. */
export function importStartedFromQuery(route: ActivatedRoute): string | undefined {
  const value = route.snapshot.queryParamMap.get(IMPORT_STARTED_FROM_PARAM);
  if (value == null) {
    return undefined;
  }
  const isNamed = Object.values<string>(ImportStartedFrom).includes(value);
  return isNamed || isId(value) ? value : undefined;
}

/** The query params that start an import on a page, or undefined for All items, which needs none.
 *  A collection means nothing without its organization, so it is dropped without one. */
export function importQueryParamsForVault(
  organizationId: string | undefined,
  collectionId: string | undefined,
  startedFrom?: string,
): Params | undefined {
  const params: Params = {};
  if (organizationId != null) {
    params[IMPORT_DEFAULT_ORGANIZATION_PARAM] = organizationId;
    if (collectionId != null) {
      params[IMPORT_DEFAULT_COLLECTION_PARAM] = collectionId;
    }
  }
  if (startedFrom != null) {
    params[IMPORT_STARTED_FROM_PARAM] = startedFrom;
  }
  return Object.keys(params).length === 0 ? undefined : params;
}

/** Moves between the import's screens, keeping `returnTo` and the vault scope in the URL. With
 *  nothing to keep it navigates exactly as a plain `router.navigate` would. */
export function navigateCarryingImportParams(
  router: Router,
  route: ActivatedRoute,
  commands: string[],
  extras: NavigationExtras = {},
): Promise<boolean> {
  const carried: Params = {};
  for (const name of CARRIED_PARAMS) {
    const value = route.snapshot.queryParamMap.get(name);
    if (value != null) {
      carried[name] = value;
    }
  }

  if (Object.keys(carried).length === 0) {
    return Object.keys(extras).length > 0
      ? router.navigate(commands, extras)
      : router.navigate(commands);
  }
  return router.navigate(commands, {
    ...extras,
    queryParams: { ...carried, ...extras.queryParams },
  });
}
