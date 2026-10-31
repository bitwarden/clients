import { ActivatedRoute } from "@angular/router";

import { isId } from "@bitwarden/common/types/guid";
import {
  ImportStartedFrom,
  importScopeFromQuery,
  importStartedFromQuery,
} from "@bitwarden/importer-ui";

import { VaultsNavViewModel } from "../models/vault-nav-view-model";
import {
  defaultUserCollectionId,
  MY_ITEMS_ROUTE,
  VaultScope,
  vaultScopeCommands,
  VaultScopeType,
} from "../models/vault-scope";

/** The `startedFrom` an import opened from this page carries, or undefined for All items and for
 *  an organization's pages that need only the organization. */
export function importStartedFrom(
  scope: VaultScope,
  nav: VaultsNavViewModel | undefined,
): string | undefined {
  switch (scope.type) {
    case VaultScopeType.MyVault:
      return ImportStartedFrom.MyVault;
    case VaultScopeType.Trash:
      return ImportStartedFrom.Trash;
    case VaultScopeType.Archive:
      return ImportStartedFrom.Archive;
    case VaultScopeType.Folder:
      return scope.folderId;
    case VaultScopeType.Organization: {
      const isMyItems =
        scope.collectionId === MY_ITEMS_ROUTE ||
        (scope.collectionId != null &&
          scope.collectionId === defaultUserCollectionId(scope.organizationId, nav));
      return isMyItems ? ImportStartedFrom.MyItems : undefined;
    }
    default:
      return undefined;
  }
}

/** The `Router.navigate` commands for the page an import was started from, as read from its URL:
 *  where the legacy import's dialog left the user on closing. All items when it names none. */
export function vaultCommandsAfterImport(route: ActivatedRoute): string[] {
  const { defaultOrganizationId, defaultCollectionId } = importScopeFromQuery(route);
  const startedFrom = importStartedFromQuery(route);

  if (defaultOrganizationId != null) {
    return vaultScopeCommands({
      type: VaultScopeType.Organization,
      organizationId: defaultOrganizationId,
      collectionId:
        startedFrom === ImportStartedFrom.MyItems ? MY_ITEMS_ROUTE : defaultCollectionId,
    });
  }

  switch (startedFrom) {
    case ImportStartedFrom.MyVault:
      return vaultScopeCommands({ type: VaultScopeType.MyVault });
    case ImportStartedFrom.Trash:
      return vaultScopeCommands({ type: VaultScopeType.Trash });
    case ImportStartedFrom.Archive:
      return vaultScopeCommands({ type: VaultScopeType.Archive });
    case undefined:
    case ImportStartedFrom.MyItems:
      return vaultScopeCommands({ type: VaultScopeType.AllItems });
    default:
      return isId(startedFrom)
        ? vaultScopeCommands({ type: VaultScopeType.Folder, folderId: startedFrom })
        : vaultScopeCommands({ type: VaultScopeType.AllItems });
  }
}
