import { Unassigned } from "@bitwarden/admin-console/common";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { RoutedVaultFilterBridgeService } from "../../services/routed-vault-filter-bridge.service";

import {
  All,
  isRoutedVaultFilterItemType,
  RoutedVaultFilterItemType,
  RoutedVaultFilterModel,
} from "./routed-vault-filter.model";
import { VaultFilter, VaultFilterFunction } from "./vault-filter.model";
import {
  OrganizationFilter,
  CipherTypeFilter,
  FolderFilter,
  CollectionFilter,
  CipherStatus,
} from "./vault-filter.type";

/**
 * This file is part of a layer that is used to temporary bridge between URL filtering and the old state-in-code method.
 * This should be removed after we have refactored the {@link VaultItemsComponent} and introduced vertical navigation
 * (which will refactor the {@link VaultFilterComponent}).
 *
 * This model supplies legacy code with the old state-in-code models saved as tree nodes.
 * It can also receive requests to select a new tree node by using setters.
 * However instead of just replacing the tree node models, it requests a URL navigation,
 * thereby bridging between legacy and URL filtering.
 */
export class RoutedVaultFilterBridge implements VaultFilter {
  constructor(
    private routedFilter: RoutedVaultFilterModel,
    private legacyFilter: VaultFilter,
    private bridgeService: RoutedVaultFilterBridgeService,
  ) {}
  get collectionBreadcrumbs(): TreeNode<CollectionFilter>[] {
    return this.legacyFilter.collectionBreadcrumbs;
  }
  get isCollectionSelected(): boolean {
    return this.legacyFilter.isCollectionSelected;
  }
  get isUnassignedCollectionSelected(): boolean {
    return this.legacyFilter.isUnassignedCollectionSelected;
  }
  get isMyVaultSelected(): boolean {
    return this.legacyFilter.isMyVaultSelected;
  }
  get selectedOrganizationNode(): TreeNode<OrganizationFilter> {
    return this.legacyFilter.selectedOrganizationNode;
  }
  set selectedOrganizationNode(value: TreeNode<OrganizationFilter>) {
    this.bridgeService.navigate({
      ...this.routedFilter,
      organizationId:
        value?.node.id === "MyVault" ? (Unassigned as OrganizationId) : value?.node.id,
      folderId: undefined,
      collectionId: undefined,
    });
  }
  get selectedCipherTypeNode(): TreeNode<CipherTypeFilter> {
    return this.legacyFilter.selectedCipherTypeNode;
  }
  set selectedCipherTypeNode(value: TreeNode<CipherTypeFilter>) {
    let type: RoutedVaultFilterItemType | undefined;

    if (value?.node.id === "AllItems" && this.routedFilter.organizationIdParamType === "path") {
      type = All;
    } else if (
      value?.node.id === "AllItems" &&
      this.routedFilter.organizationIdParamType === "query"
    ) {
      type = undefined;
    } else if (isRoutedVaultFilterItemType(value?.node.id)) {
      type = value?.node.id;
    }

    this.bridgeService.navigate({
      ...this.routedFilter,
      type,
      folderId: undefined,
      collectionId: undefined,
    });
  }
  get selectedFolderNode(): TreeNode<FolderFilter> {
    return this.legacyFilter.selectedFolderNode;
  }
  set selectedFolderNode(value: TreeNode<FolderFilter>) {
    const folderId = value != null && value.node.id === null ? Unassigned : value?.node.id;
    this.bridgeService.navigate({
      ...this.routedFilter,
      folderId,
      type: undefined,
      collectionId: undefined,
    });
  }
  get selectedCollectionNode(): TreeNode<CollectionFilter> {
    return this.legacyFilter.selectedCollectionNode;
  }
  set selectedCollectionNode(value: TreeNode<CollectionFilter>) {
    let collectionId: CollectionId | All | undefined;

    if (value != null && value.node.id === null) {
      collectionId = Unassigned as CollectionId;
    } else if (
      value?.node.id === "AllCollections" &&
      this.routedFilter.organizationIdParamType === "path"
    ) {
      collectionId = undefined;
    } else if (
      value?.node.id === "AllCollections" &&
      this.routedFilter.organizationIdParamType === "query"
    ) {
      collectionId = All;
    } else {
      collectionId = value?.node.id;
    }

    this.bridgeService.navigate({
      ...this.routedFilter,
      collectionId,
      type: undefined,
      folderId: undefined,
    });
  }
  get isFavorites(): boolean {
    return this.legacyFilter.isFavorites;
  }
  get isDeleted(): boolean {
    return this.legacyFilter.isDeleted;
  }
  get organizationId(): string {
    return this.legacyFilter.organizationId;
  }
  get cipherType(): CipherType {
    return this.legacyFilter.cipherType;
  }
  get cipherStatus(): CipherStatus {
    return this.legacyFilter.cipherStatus;
  }
  get cipherTypeId(): string {
    return this.legacyFilter.cipherTypeId;
  }
  get folderId(): string {
    return this.legacyFilter.folderId;
  }
  get collectionId(): string {
    return this.legacyFilter.collectionId;
  }
  resetFilter(): void {
    this.bridgeService.navigate({
      ...this.routedFilter,
      collectionId: undefined,
      folderId: undefined,
      organizationId:
        this.routedFilter.organizationIdParamType === "path"
          ? this.routedFilter.organizationId
          : undefined,
      type: undefined,
    });
  }
  resetOrganization(): void {
    this.bridgeService.navigate({ ...this.routedFilter, organizationId: undefined });
  }
  buildFilter(): VaultFilterFunction {
    return this.legacyFilter.buildFilter();
  }
}
