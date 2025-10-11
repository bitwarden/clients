// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { firstValueFrom, Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { DeprecatedVaultFilterService } from "../../abstractions/deprecated-vault-filter.service";
import { DynamicTreeNode } from "../models/dynamic-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

// TODO: Replace with refactored web vault filter component
// and refactor desktop/browser vault filters
@Directive()
export class VaultFilterComponent implements OnInit {
  @Input() activeFilter: VaultFilter = new VaultFilter();
  @Input() hideFolders = false;
  @Input() hideCollections = false;
  @Input() hideFavorites = false;
  @Input() hideTrash = false;
  @Input() hideOrganizations = false;

  @Output() onFilterChange = new EventEmitter<VaultFilter>();
  @Output() onAddFolder = new EventEmitter<never>();
  @Output() onEditFolder = new EventEmitter<FolderView>();

  private activeUserId: UserId;

  isLoaded = false;
  collapsedFilterNodes: Set<string>;
  organizations: Organization[];
  activeOrganizationDataOwnershipPolicy: boolean;
  activeSingleOrganizationPolicy: boolean;
  collections: DynamicTreeNode<CollectionView>;
  folders$: Observable<DynamicTreeNode<FolderView>>;

  protected showArchiveVaultFilter = false;

  constructor(
    protected vaultFilterService: DeprecatedVaultFilterService,
    protected accountService: AccountService,
    protected cipherArchiveService: CipherArchiveService,
  ) {}

  get displayCollections() {
    return this.collections?.fullList != null && this.collections.fullList.length > 0;
  }

  async ngOnInit(): Promise<void> {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.collapsedFilterNodes = await this.vaultFilterService.buildCollapsedFilterNodes(
      this.activeUserId,
    );
    this.organizations = await this.vaultFilterService.buildOrganizations();
    if (this.organizations != null && this.organizations.length > 0) {
      this.activeOrganizationDataOwnershipPolicy =
        await this.vaultFilterService.checkForOrganizationDataOwnershipPolicy();
      this.activeSingleOrganizationPolicy =
        await this.vaultFilterService.checkForSingleOrganizationPolicy();
    }
    this.folders$ = await this.vaultFilterService.buildNestedFolders();
    this.collections = await this.initCollections();

    const userCanArchive = await firstValueFrom(
      this.cipherArchiveService.userCanArchive$(this.activeUserId),
    );
    const showArchiveVault = await firstValueFrom(
      this.cipherArchiveService.showArchiveVault$(this.activeUserId),
    );

    this.showArchiveVaultFilter = userCanArchive || showArchiveVault;
    this.isLoaded = true;
  }

  // overwritten in web for organization vaults
  async initCollections() {
    return await this.vaultFilterService.buildCollections();
  }

  async toggleFilterNodeCollapseState(node: ITreeNodeObject) {
    if (this.collapsedFilterNodes.has(node.id)) {
      this.collapsedFilterNodes.delete(node.id);
    } else {
      this.collapsedFilterNodes.add(node.id);
    }
    await this.vaultFilterService.storeCollapsedFilterNodes(
      this.collapsedFilterNodes,
      this.activeUserId,
    );
  }

  async applyFilter(filter: VaultFilter) {
    if (filter.refreshCollectionsAndFolders) {
      await this.reloadCollectionsAndFolders(filter);
      filter = await this.pruneInvalidatedFilterSelections(filter);
    }
    this.onFilterChange.emit(filter);
  }

  async reloadCollectionsAndFolders(filter: VaultFilter) {
    this.folders$ = await this.vaultFilterService.buildNestedFolders(filter.selectedOrganizationId);
    this.collections = filter.myVaultOnly
      ? null
      : await this.vaultFilterService.buildCollections(filter.selectedOrganizationId);
  }

  async reloadOrganizations() {
    this.organizations = await this.vaultFilterService.buildOrganizations();
    this.activeOrganizationDataOwnershipPolicy =
      await this.vaultFilterService.checkForOrganizationDataOwnershipPolicy();
    this.activeSingleOrganizationPolicy =
      await this.vaultFilterService.checkForSingleOrganizationPolicy();
  }

  addFolder() {
    this.onAddFolder.emit();
  }

  editFolder(folder: FolderView) {
    this.onEditFolder.emit(folder);
  }

  protected async pruneInvalidatedFilterSelections(filter: VaultFilter): Promise<VaultFilter> {
    filter = await this.pruneInvalidFolderSelection(filter);
    filter = this.pruneInvalidCollectionSelection(filter);
    return filter;
  }

  protected async pruneInvalidFolderSelection(filter: VaultFilter): Promise<VaultFilter> {
    if (
      filter.selectedFolder &&
      !(await firstValueFrom(this.folders$))?.hasId(filter.selectedFolderId)
    ) {
      filter.selectedFolder = false;
      filter.selectedFolderId = null;
    }
    return filter;
  }

  protected pruneInvalidCollectionSelection(filter: VaultFilter): VaultFilter {
    if (
      filter.myVaultOnly ||
      (filter.selectedCollection &&
        filter.selectedCollectionId != null &&
        !this.collections?.hasId(filter.selectedCollectionId))
    ) {
      filter.selectedCollection = false;
      filter.selectedCollectionId = null;
    }
    return filter;
  }
}
