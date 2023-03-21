import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { EventType } from "@bitwarden/common/enums/eventType";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, Icons } from "@bitwarden/components";

import { CollectionAdminView, GroupView } from "../../organizations/core";

import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "./bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import {
  BulkMoveDialogResult,
  openBulkMoveDialog,
} from "./bulk-action-dialogs/bulk-move-dialog/bulk-move-dialog.component";
import {
  BulkRestoreDialogResult,
  openBulkRestoreDialog,
} from "./bulk-action-dialogs/bulk-restore-dialog/bulk-restore-dialog.component";
import {
  BulkShareDialogResult,
  openBulkShareDialog,
} from "./bulk-action-dialogs/bulk-share-dialog/bulk-share-dialog.component";
import { VaultFilterService } from "./vault-filter/services/abstractions/vault-filter.service";
import { VaultFilter } from "./vault-filter/shared/models/vault-filter.model";
import { CollectionFilter } from "./vault-filter/shared/models/vault-filter.type";

const MaxCheckedCount = 500;

export type VaultItemRow = (CipherView | TreeNode<CollectionFilter>) & { checked?: boolean };

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
})
export class VaultItemsComponent extends BaseVaultItemsComponent implements OnDestroy {
  @Output() activeFilterChanged = new EventEmitter<VaultFilter>();
  @Output() onAttachmentsClicked = new EventEmitter<CipherView>();
  @Output() onShareClicked = new EventEmitter<CipherView>();
  @Output() onEditCipherCollectionsClicked = new EventEmitter<CipherView>();
  @Output() onCloneClicked = new EventEmitter<CipherView>();
  @Output() onOrganzationBadgeClicked = new EventEmitter<string>();

  private _activeFilter: VaultFilter;
  @Input() get activeFilter(): VaultFilter {
    return this._activeFilter;
  }
  set activeFilter(value: VaultFilter) {
    this._activeFilter = value;
    this.reload(this.activeFilter.buildFilter(), this.activeFilter.isDeleted);
  }

  cipherType = CipherType;
  actionPromise: Promise<any>;
  userHasPremiumAccess = false;
  organizations: Organization[] = [];
  profileName: string;
  noItemIcon = Icons.Search;
  groups: GroupView[] = [];

  protected pageSizeLimit = 200;
  protected isAllChecked = false;
  protected didScroll = false;
  protected currentPagedCiphersCount = 0;
  protected currentPagedCollectionsCount = 0;
  protected refreshing = false;

  protected pagedCiphers: CipherView[] = [];
  protected pagedCollections: TreeNode<CollectionFilter>[] = [];
  protected searchedCollections: TreeNode<CollectionFilter>[] = [];

  get showAddNew() {
    return !this.activeFilter.isDeleted;
  }

  get collections(): TreeNode<CollectionFilter>[] {
    return this.activeFilter?.selectedCollectionNode?.children ?? [];
  }

  get filteredCollections(): TreeNode<CollectionFilter>[] {
    if (this.isPaging()) {
      return this.pagedCollections;
    }

    if (this.searchService.isSearchable(this.searchText)) {
      return this.searchedCollections;
    }

    return this.collections;
  }

  get filteredCiphers(): CipherView[] {
    return this.isPaging() ? this.pagedCiphers : this.ciphers;
  }

  constructor(
    searchService: SearchService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected vaultFilterService: VaultFilterService,
    protected cipherService: CipherService,
    protected eventCollectionService: EventCollectionService,
    protected totpService: TotpService,
    protected stateService: StateService,
    protected passwordRepromptService: PasswordRepromptService,
    protected dialogService: DialogService,
    protected logService: LogService,
    private searchPipe: SearchPipe,
    private organizationService: OrganizationService,
    private tokenService: TokenService
  ) {
    super(searchService);
  }

  ngOnDestroy() {
    this.checkAll(false);
  }

  async applyFilter(filter: (cipher: CipherView) => boolean = null) {
    this.checkAll(false);
    this.isAllChecked = false;
    this.pagedCollections = [];
    if (!this.refreshing && this.isPaging()) {
      this.currentPagedCollectionsCount = 0;
      this.currentPagedCiphersCount = 0;
    }
    await super.applyFilter(filter);
  }

  // load() is called after the page loads and the first sync has completed.
  // Do not use ngOnInit() for anything that requires sync data.
  async load(filter: (cipher: CipherView) => boolean = null, deleted = false) {
    await super.load(filter, deleted);
    this.updateSearchedCollections(this.collections);
    this.profileName = await this.tokenService.getName();
    this.organizations = await this.organizationService.getAll();
    this.userHasPremiumAccess = await this.stateService.getCanAccessPremium();
  }

  async refresh() {
    try {
      this.refreshing = true;
      await this.reload(this.filter, this.deleted);
    } finally {
      this.refreshing = false;
    }
  }

  loadMore() {
    // If we have less rows than the page size, we don't need to page anything
    if (this.ciphers.length + (this.collections?.length || 0) <= this.pageSizeLimit) {
      return;
    }

    let pageSpaceLeft = this.pageSizeLimit;
    if (
      this.refreshing &&
      this.pagedCiphers.length + this.pagedCollections.length === 0 &&
      this.currentPagedCiphersCount + this.currentPagedCollectionsCount > this.pageSizeLimit
    ) {
      // When we refresh, we want to load the previous amount of items, not restart the paging
      pageSpaceLeft = this.currentPagedCiphersCount + this.currentPagedCollectionsCount;
    }
    // if there are still collections to show
    if (this.collections?.length > this.pagedCollections.length) {
      const collectionsToAdd = this.collections.slice(
        this.pagedCollections.length,
        this.currentPagedCollectionsCount + pageSpaceLeft
      );
      this.pagedCollections = this.pagedCollections.concat(collectionsToAdd);
      // set the current count to the new count of paged collections
      this.currentPagedCollectionsCount = this.pagedCollections.length;
      // subtract the available page size by the amount of collections we just added, default to 0 if negative
      pageSpaceLeft =
        collectionsToAdd.length > pageSpaceLeft ? 0 : pageSpaceLeft - collectionsToAdd.length;
    }
    // if we have room left to show ciphers and we have ciphers to show
    if (pageSpaceLeft > 0 && this.ciphers.length > this.pagedCiphers.length) {
      this.pagedCiphers = this.pagedCiphers.concat(
        this.ciphers.slice(this.pagedCiphers.length, this.currentPagedCiphersCount + pageSpaceLeft)
      );
      // set the current count to the new count of paged ciphers
      this.currentPagedCiphersCount = this.pagedCiphers.length;
    }
    // set a flag if we actually loaded the second page while paging
    this.didScroll = this.pagedCiphers.length + this.pagedCollections.length > this.pageSizeLimit;
  }

  isPaging() {
    const searching = this.isSearching();
    if (searching && this.didScroll) {
      this.resetPaging();
    }
    const totalRows =
      this.ciphers.length + (this.activeFilter?.selectedCollectionNode?.children.length || 0);
    return !searching && totalRows > this.pageSizeLimit;
  }

  async resetPaging() {
    this.pagedCollections = [];
    this.pagedCiphers = [];
    this.loadMore();
  }

  async doSearch(indexedCiphers?: CipherView[]) {
    this.ciphers = await this.searchService.searchCiphers(
      this.searchText,
      [this.filter, this.deletedFilter],
      indexedCiphers
    );
    this.updateSearchedCollections(this.collections);
    this.resetPaging();
  }

  launch(uri: string) {
    this.platformUtilsService.launchUri(uri);
  }

  async attachments(c: CipherView) {
    if (!(await this.repromptCipher(c))) {
      return;
    }
    this.onAttachmentsClicked.emit(c);
  }

  async share(c: CipherView) {
    if (!(await this.repromptCipher(c))) {
      return;
    }
    this.onShareClicked.emit(c);
  }

  editCipherCollections(c: CipherView) {
    this.onEditCipherCollectionsClicked.emit(c);
  }

  async clone(c: CipherView) {
    if (!(await this.repromptCipher(c))) {
      return;
    }
    this.onCloneClicked.emit(c);
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
    if (!(await this.repromptCipher(c))) {
      return;
    }
    if (this.actionPromise != null) {
      return;
    }
    const permanent = c.isDeleted;
    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t(
        permanent ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation"
      ),
      this.i18nService.t(permanent ? "permanentlyDeleteItem" : "deleteItem"),
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );
    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.deleteCipherWithServer(c.id, permanent);
      await this.actionPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem")
      );
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
    this.actionPromise = null;
  }

  async bulkDelete() {
    if (!(await this.repromptCipher())) {
      return;
    }

    const selectedIds = this.selectedCipherIds;
    if (selectedIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: { permanent: this.deleted, cipherIds: selectedIds as Guid[] },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkDeleteDialogResult.Deleted) {
      this.actionPromise = this.refresh();
      await this.actionPromise;
      this.actionPromise = null;
    }
  }

  async restore(c: CipherView): Promise<boolean> {
    if (this.actionPromise != null || !c.isDeleted) {
      return;
    }
    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t("restoreItemConfirmation"),
      this.i18nService.t("restoreItem"),
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );
    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.cipherService.restoreWithServer(c.id);
      await this.actionPromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItem"));
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
    this.actionPromise = null;
  }

  async bulkRestore() {
    if (!(await this.repromptCipher())) {
      return;
    }

    const selectedCipherIds = this.selectedCipherIds;
    if (selectedCipherIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    const dialog = openBulkRestoreDialog(this.dialogService, {
      data: { cipherIds: selectedCipherIds },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkRestoreDialogResult.Restored) {
      this.actionPromise = this.refresh();
      await this.actionPromise;
      this.actionPromise = null;
    }
  }

  async bulkShare() {
    if (!(await this.repromptCipher())) {
      return;
    }

    const selectedCiphers = this.selectedCiphers;
    if (selectedCiphers.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    const dialog = openBulkShareDialog(this.dialogService, { data: { ciphers: selectedCiphers } });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkShareDialogResult.Shared) {
      this.actionPromise = this.refresh();
      await this.actionPromise;
      this.actionPromise = null;
    }
  }

  async bulkMove() {
    if (!(await this.repromptCipher())) {
      return;
    }

    const selectedCipherIds = this.selectedCipherIds;
    if (selectedCipherIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    const dialog = openBulkMoveDialog(this.dialogService, {
      data: { cipherIds: selectedCipherIds },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkMoveDialogResult.Moved) {
      this.actionPromise = this.refresh();
      await this.actionPromise;
      this.actionPromise = null;
    }
  }

  async copy(cipher: CipherView, value: string, typeI18nKey: string, aType: string) {
    if (
      this.passwordRepromptService.protectedFields().includes(aType) &&
      !(await this.repromptCipher(cipher))
    ) {
      return;
    }

    if (value == null || (aType === "TOTP" && !this.displayTotpCopyButton(cipher))) {
      return;
    } else if (value === cipher.login.totp) {
      value = await this.totpService.getCode(value);
    }

    if (!cipher.viewPassword) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey))
    );

    if (typeI18nKey === "password" || typeI18nKey === "verificationCodeTotp") {
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledHiddenFieldVisible,
        cipher.id
      );
    } else if (typeI18nKey === "securityCode") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, cipher.id);
    }
  }

  navigateCollection(node: TreeNode<CollectionFilter>) {
    const filter = this.activeFilter;
    filter.selectedCollectionNode = node;
    this.activeFilterChanged.emit(filter);
  }

  checkAll(select: boolean) {
    if (select) {
      this.checkAll(false);
    }
    const items: VaultItemRow[] = this.ciphers;
    if (!items) {
      return;
    }

    const selectCount = select && items.length > MaxCheckedCount ? MaxCheckedCount : items.length;
    for (let i = 0; i < selectCount; i++) {
      this.checkRow(items[i], select);
    }
  }

  checkRow(item: VaultItemRow, select?: boolean) {
    // Collections can't be managed in end user vault
    if (!(item instanceof CipherView)) {
      return;
    }
    item.checked = select ?? !item.checked;
  }

  get selectedCiphers(): CipherView[] {
    if (!this.ciphers) {
      return [];
    }
    return this.ciphers.filter((c) => !!(c as VaultItemRow).checked);
  }

  get selectedCipherIds(): string[] {
    return this.selectedCiphers.map((c) => c.id);
  }

  displayTotpCopyButton(cipher: CipherView) {
    return (
      (cipher?.login?.hasTotp ?? false) && (cipher.organizationUseTotp || this.userHasPremiumAccess)
    );
  }

  onOrganizationClicked(organizationId: string) {
    this.onOrganzationBadgeClicked.emit(organizationId);
  }

  events(c: CipherView) {
    // TODO: This should be removed but is needed since we reuse the same template
  }

  canDeleteCollection(c: CollectionAdminView): boolean {
    // TODO: This should be removed but is needed since we reuse the same template
    return false; // Always return false for non org vault
  }

  async deleteCollection(collection: CollectionView): Promise<void> {
    // TODO: This should be removed but is needed since we reuse the same template
  }

  canEditCollection(c: CollectionAdminView): boolean {
    // TODO: This should be removed but is needed since we reuse the same template
    return false; // Always return false for non org vault
  }

  async editCollection(c: CollectionView, tab: "info" | "access"): Promise<void> {
    // TODO: This should be removed but is needed since we reuse the same template
  }

  get showMissingCollectionPermissionMessage(): boolean {
    // TODO: This should be removed but is needed since we reuse the same template
    return false; // Always return false for non org vault
  }

  /**
   * @deprecated Block interaction using long running modal dialog instead
   */
  protected get isProcessingAction() {
    return this.actionPromise != null;
  }

  protected updateSearchedCollections(collections: TreeNode<CollectionFilter>[]) {
    if (this.searchService.isSearchable(this.searchText)) {
      this.searchedCollections = this.searchPipe.transform(
        collections,
        this.searchText,
        (collection) => collection.node.name,
        (collection) => collection.node.id
      );
    }
  }

  protected deleteCipherWithServer(id: string, permanent: boolean) {
    return permanent
      ? this.cipherService.deleteWithServer(id)
      : this.cipherService.softDeleteWithServer(id);
  }

  protected showFixOldAttachments(c: CipherView) {
    return c.hasOldAttachments && c.organizationId == null;
  }

  protected async repromptCipher(c?: CipherView) {
    if (c) {
      return (
        c.reprompt === CipherRepromptType.None ||
        (await this.passwordRepromptService.showPasswordPrompt())
      );
    } else {
      const selectedCiphers = this.selectedCiphers;
      const notProtected = !selectedCiphers.find(
        (cipher) => cipher.reprompt !== CipherRepromptType.None
      );

      return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
    }
  }
}
