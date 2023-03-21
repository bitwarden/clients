import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { CollectionAdminView } from "../../organizations/core";
import { GroupService } from "../../organizations/core/services/group/group.service";
import {
  CollectionDialogResult,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../organizations/shared/components/collection-dialog/collection-dialog.component";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "../individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import { VaultFilterService } from "../individual-vault/vault-filter/services/abstractions/vault-filter.service";
import { CollectionFilter } from "../individual-vault/vault-filter/shared/models/vault-filter.type";
import {
  VaultItemRow,
  VaultItemsComponent as BaseVaultItemsComponent,
} from "../individual-vault/vault-items.component";

const MaxCheckedCount = 500;

@Component({
  selector: "app-org-vault-items",
  templateUrl: "../individual-vault/vault-items.component.html",
})
export class VaultItemsComponent extends BaseVaultItemsComponent implements OnDestroy {
  @Input() set initOrganization(value: Organization) {
    this.organization = value;
    this.changeOrganization();
  }
  @Output() onEventsClicked = new EventEmitter<CipherView>();

  protected allCiphers: CipherView[] = [];

  constructor(
    searchService: SearchService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    cipherService: CipherService,
    vaultFilterService: VaultFilterService,
    eventCollectionService: EventCollectionService,
    totpService: TotpService,
    passwordRepromptService: PasswordRepromptService,
    dialogService: DialogService,
    logService: LogService,
    stateService: StateService,
    organizationService: OrganizationService,
    tokenService: TokenService,
    searchPipe: SearchPipe,
    protected groupService: GroupService,
    private apiService: ApiService
  ) {
    super(
      searchService,
      i18nService,
      platformUtilsService,
      vaultFilterService,
      cipherService,
      eventCollectionService,
      totpService,
      stateService,
      passwordRepromptService,
      dialogService,
      logService,
      searchPipe,
      organizationService,
      tokenService
    );
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  async changeOrganization() {
    this.groups = await this.groupService.getAll(this.organization?.id);
    await this.loadCiphers();
    await this.reload(this.activeFilter.buildFilter());
  }

  async loadCiphers() {
    if (this.organization?.canEditAnyCollection) {
      this.accessEvents = this.organization?.useEvents;
      this.allCiphers = await this.cipherService.getAllFromApiForOrganization(
        this.organization?.id
      );
    } else {
      this.allCiphers = (await this.cipherService.getAllDecrypted()).filter(
        (c) => c.organizationId === this.organization?.id
      );
    }
    await this.searchService.indexCiphers(this.organization?.id, this.allCiphers);
  }

  async refreshCollections(): Promise<void> {
    await this.vaultFilterService.reloadCollections();
    if (this.activeFilter.selectedCollectionNode) {
      this.activeFilter.selectedCollectionNode =
        await this.vaultFilterService.getCollectionNodeFromTree(
          this.activeFilter.selectedCollectionNode.node.id
        );
    }
  }

  async load(filter: (cipher: CipherView) => boolean = null, deleted = false) {
    this.deleted = deleted ?? false;
    await this.applyFilter(filter);
    this.loaded = true;
  }

  async refresh() {
    await this.loadCiphers();
    await this.refreshCollections();
    super.refresh();
  }

  async search(timeout: number = null) {
    await super.search(timeout, this.allCiphers);
  }

  events(c: CipherView) {
    this.onEventsClicked.emit(c);
  }

  protected showFixOldAttachments(c: CipherView) {
    return this.organization?.canEditAnyCollection && c.hasOldAttachments;
  }

  checkAll(select: boolean) {
    if (select) {
      this.checkAll(false);
    }

    const items: VaultItemRow[] = [...this.collections, ...this.ciphers];
    if (!items.length) {
      return;
    }

    const selectCount = select && items.length > MaxCheckedCount ? MaxCheckedCount : items.length;
    for (let i = 0; i < selectCount; i++) {
      this.checkRow(items[i], select);
    }
  }

  checkRow(item: VaultItemRow, select?: boolean) {
    if (item instanceof TreeNode && item.node.id == null) {
      return;
    }

    // Do not allow checking a collection we cannot delete
    if (item instanceof TreeNode && !this.canDeleteCollection(item.node)) {
      return;
    }

    item.checked = select ?? !item.checked;
  }

  get selectedCollections(): TreeNode<CollectionFilter>[] {
    if (!this.collections) {
      return [];
    }
    return this.collections.filter((c) => !!(c as VaultItemRow).checked);
  }

  get selectedCollectionIds(): string[] {
    return this.selectedCollections.map((c) => c.node.id);
  }

  canEditCollection(c: CollectionAdminView): boolean {
    // Only edit collections if we're in the org vault and not editing "Unassigned"
    if (this.organization === undefined || c.id === null) {
      return false;
    }

    // Otherwise, check if we can edit the specified collection
    return (
      this.organization.canEditAnyCollection ||
      (this.organization.canEditAssignedCollections && c.assigned)
    );
  }

  async editCollection(c: CollectionView, tab: "info" | "access"): Promise<void> {
    const tabType = tab == "info" ? CollectionDialogTabType.Info : CollectionDialogTabType.Access;

    const dialog = openCollectionDialog(this.dialogService, {
      data: { collectionId: c?.id, organizationId: this.organization?.id, initialTab: tabType },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionDialogResult.Saved || result === CollectionDialogResult.Deleted) {
      this.actionPromise = this.refresh();
      await this.actionPromise;
      this.actionPromise = null;
    }
  }

  get showMissingCollectionPermissionMessage(): boolean {
    // Not filtering by collections, so no need to show message
    if (this.activeFilter.selectedCollectionNode == null) {
      return false;
    }

    // Filtering by all collections, so no need to show message
    if (this.activeFilter.selectedCollectionNode.node.id == "AllCollections") {
      return false;
    }

    // Filtering by a collection, so show message if user is not assigned
    return !this.activeFilter.selectedCollectionNode.node.assigned && !this.organization.isAdmin;
  }

  canDeleteCollection(c: CollectionAdminView): boolean {
    // Only delete collections if we're in the org vault and not deleting "Unassigned"
    if (this.organization === undefined || c.id === null) {
      return false;
    }

    // Otherwise, check if we can delete the specified collection
    return (
      this.organization?.canDeleteAnyCollection ||
      (this.organization?.canDeleteAssignedCollections && c.assigned)
    );
  }

  async deleteCollection(collection: CollectionView): Promise<void> {
    if (
      !this.organization.canDeleteAssignedCollections &&
      !this.organization.canDeleteAnyCollection
    ) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("missingPermissions")
      );
      return;
    }
    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t("deleteCollectionConfirmation"),
      collection.name,
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );
    if (!confirmed) {
      return;
    }
    try {
      this.actionPromise = this.apiService.deleteCollection(this.organization?.id, collection.id);
      await this.actionPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedCollectionId", collection.name)
      );
      this.actionPromise = null;
      await this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkDelete() {
    if (!(await this.repromptCipher())) {
      return;
    }

    const selectedCipherIds = this.selectedCipherIds;
    const selectedCollectionIds = this.deleted ? null : this.selectedCollectionIds;

    if (!selectedCipherIds?.length && !selectedCollectionIds?.length) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: {
        permanent: this.deleted,
        cipherIds: selectedCipherIds as Guid[],
        collectionIds: selectedCollectionIds as Guid[],
        organization: this.organization,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkDeleteDialogResult.Deleted) {
      this.actionPromise = this.refresh();
      await this.actionPromise;
      this.actionPromise = null;
    }
  }

  /**
   * @deprecated Block interaction using long running modal dialog instead
   */
  protected get isProcessingAction() {
    return this.actionPromise != null;
  }

  protected deleteCipherWithServer(id: string, permanent: boolean) {
    if (!this.organization?.canEditAnyCollection) {
      return super.deleteCipherWithServer(id, this.deleted);
    }
    return permanent
      ? this.apiService.deleteCipherAdmin(id)
      : this.apiService.putDeleteCipherAdmin(id);
  }
}
