// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { combineLatest, map, Observable } from "rxjs";

import { Unassigned } from "@bitwarden/admin-console/common";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";

import { RoutedVaultFilterBridge } from "../shared/models/routed-vault-filter-bridge.model";
import { RoutedVaultFilterModel, All } from "../shared/models/routed-vault-filter.model";
import { VaultFilter } from "../shared/models/vault-filter.model";
import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "../shared/models/vault-filter.type";

import { VaultFilterService } from "./abstractions/vault-filter.service";
import { RoutedVaultFilterService } from "./routed-vault-filter.service";

/**
 * This file is part of a layer that is used to temporary bridge between URL filtering and the old state-in-code method.
 * This should be removed after we have refactored the {@link VaultItemsComponent} and introduced vertical navigation
 * (which will refactor the {@link VaultFilterComponent}).
 *
 * This class listens to both the new {@link RoutedVaultFilterService} and the old {@link VaultFilterService}.
 * When a new filter is emitted the service uses the ids to find the corresponding tree nodes needed for
 * the old {@link VaultFilter} model. It then emits a bridge model that contains this information.
 */
@Injectable()
export class RoutedVaultFilterBridgeService {
  readonly activeFilter$: Observable<VaultFilter>;

  constructor(
    private router: Router,
    private routedVaultFilterService: RoutedVaultFilterService,
    legacyVaultFilterService: VaultFilterService,
  ) {
    this.activeFilter$ = combineLatest([
      routedVaultFilterService.filter$,
      legacyVaultFilterService.collectionTree$,
      legacyVaultFilterService.folderTree$,
      legacyVaultFilterService.organizationTree$,
      legacyVaultFilterService.cipherTypeTree$,
    ]).pipe(
      map(([filter, collectionTree, folderTree, organizationTree, cipherTypeTree]) => {
        const legacyFilter = isAdminConsole(filter)
          ? createLegacyFilterForAdminConsole(filter, collectionTree, cipherTypeTree)
          : createLegacyFilterForEndUser(
              filter,
              collectionTree,
              folderTree,
              organizationTree,
              cipherTypeTree,
            );

        return new RoutedVaultFilterBridge(filter, legacyFilter, this);
      }),
    );
  }

  navigate(filter: RoutedVaultFilterModel) {
    const [commands, extras] = this.routedVaultFilterService.createRoute(filter);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(commands, extras);
  }
}

/**
 * Check if the filtering is being done as part of admin console.
 * Admin console can be identified by checking if the `organizationId`
 * is part of the path.
 *
 * @param filter Model to check if origin is admin console
 * @returns true if filtering being done as part of admin console
 */
function isAdminConsole(filter: RoutedVaultFilterModel) {
  return filter.organizationIdParamType === "path";
}

function createLegacyFilterForAdminConsole(
  filter: RoutedVaultFilterModel,
  collectionTree: TreeNode<CollectionFilter>,
  cipherTypeTree: TreeNode<CipherTypeFilter>,
): VaultFilter {
  const legacyFilter = new VaultFilter();

  if (filter.collectionId === undefined && filter.type === undefined) {
    legacyFilter.selectedCollectionNode = ServiceUtils.getTreeNodeObject(
      collectionTree,
      "AllCollections",
    );
  } else if (filter.collectionId !== undefined && filter.collectionId === Unassigned) {
    legacyFilter.selectedCollectionNode = ServiceUtils.getTreeNodeObject(collectionTree, null);
  } else if (filter.collectionId !== undefined) {
    legacyFilter.selectedCollectionNode = ServiceUtils.getTreeNodeObject(
      collectionTree,
      filter.collectionId,
    );
  }

  if (filter.collectionId === undefined && filter.type === All) {
    legacyFilter.selectedCipherTypeNode = ServiceUtils.getTreeNodeObject(
      cipherTypeTree,
      "AllItems",
    );
  } else if (filter.type !== undefined && filter.type === "trash") {
    legacyFilter.selectedCipherTypeNode = new TreeNode<CipherTypeFilter>(
      { id: "trash", name: "", type: "trash", icon: "" },
      null,
    );
  } else if (filter.type !== undefined && filter.type !== "trash") {
    legacyFilter.selectedCipherTypeNode = ServiceUtils.getTreeNodeObject(
      cipherTypeTree,
      filter.type,
    );
  }

  return legacyFilter;
}

function createLegacyFilterForEndUser(
  filter: RoutedVaultFilterModel,
  collectionTree: TreeNode<CollectionFilter>,
  folderTree: TreeNode<FolderFilter>,
  organizationTree: TreeNode<OrganizationFilter>,
  cipherTypeTree: TreeNode<CipherTypeFilter>,
): VaultFilter {
  const legacyFilter = new VaultFilter();

  if (filter.collectionId !== undefined && filter.collectionId === Unassigned) {
    legacyFilter.selectedCollectionNode = ServiceUtils.getTreeNodeObject(collectionTree, null);
  } else if (filter.collectionId !== undefined && filter.collectionId === All) {
    legacyFilter.selectedCollectionNode = ServiceUtils.getTreeNodeObject(
      collectionTree,
      "AllCollections",
    );
  } else if (filter.collectionId !== undefined) {
    legacyFilter.selectedCollectionNode = ServiceUtils.getTreeNodeObject(
      collectionTree,
      filter.collectionId,
    );
  }

  if (filter.folderId !== undefined && filter.folderId === Unassigned) {
    legacyFilter.selectedFolderNode = ServiceUtils.getTreeNodeObject(folderTree, null);
  } else if (filter.folderId !== undefined && filter.folderId !== Unassigned) {
    legacyFilter.selectedFolderNode = ServiceUtils.getTreeNodeObject(folderTree, filter.folderId);
  }

  if (filter.organizationId !== undefined && filter.organizationId === Unassigned) {
    legacyFilter.selectedOrganizationNode = ServiceUtils.getTreeNodeObject(
      organizationTree,
      "MyVault",
    );
  } else if (filter.organizationId !== undefined && filter.organizationId !== Unassigned) {
    legacyFilter.selectedOrganizationNode = ServiceUtils.getTreeNodeObject(
      organizationTree,
      filter.organizationId,
    );
  }

  if (filter.type === undefined) {
    legacyFilter.selectedCipherTypeNode = ServiceUtils.getTreeNodeObject(
      cipherTypeTree,
      "AllItems",
    );
  } else if (filter.type !== undefined && filter.type === "trash") {
    legacyFilter.selectedCipherTypeNode = new TreeNode<CipherTypeFilter>(
      { id: "trash", name: "", type: "trash", icon: "" },
      null,
    );
  } else if (filter.type !== undefined && filter.type === "archive") {
    legacyFilter.selectedCipherTypeNode = new TreeNode<CipherTypeFilter>(
      { id: "archive", name: "", type: "archive", icon: "" },
      null,
    );
  } else if (filter.type !== undefined && filter.type !== "trash") {
    legacyFilter.selectedCipherTypeNode = ServiceUtils.getTreeNodeObject(
      cipherTypeTree,
      filter.type,
    );
  }

  return legacyFilter;
}
