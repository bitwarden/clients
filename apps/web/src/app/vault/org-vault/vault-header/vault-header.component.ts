import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProductType } from "@bitwarden/common/enums/productType";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import {
  DialogService,
  SimpleDialogCloseType,
  SimpleDialogOptions,
  SimpleDialogType,
} from "@bitwarden/components";

import { CollectionAdminService, CollectionAdminView } from "../../../organizations/core";
import {
  CollectionDialogResult,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../../organizations/shared";
import { VaultFilterService } from "../../individual-vault/vault-filter/services/abstractions/vault-filter.service";
import { VaultFilter } from "../../individual-vault/vault-filter/shared/models/vault-filter.model";
import { CollectionFilter } from "../../individual-vault/vault-filter/shared/models/vault-filter.type";

@Component({
  selector: "app-org-vault-header",
  templateUrl: "./vault-header.component.html",
})
export class VaultHeaderComponent {
  /**
   * The organization currently being viewed
   */
  @Input() organization: Organization;

  /**
   * Promise that is used to determine the loading state of the header via the ApiAction directive.
   * When the promise exists and is not resolved, the loading spinner will be shown.
   */
  @Input() actionPromise: Promise<any>;

  /**
   * The filter being actively applied to the vault view
   */
  @Input() activeFilter: VaultFilter;

  /**
   * Emits when the active filter has been modified by the header
   */
  @Output() activeFilterChanged = new EventEmitter<VaultFilter>();

  /**
   * Emits an event when a collection is modified or deleted via the header collection dropdown menu
   */
  @Output() onCollectionChanged = new EventEmitter<CollectionView | null>();

  /**
   * Emits an event when the new item button is clicked in the header
   */
  @Output() onAddCipher = new EventEmitter<void>();

  protected organizations$ = this.organizationService.organizations$;

  constructor(
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private vaultFilterService: VaultFilterService,
    private platformUtilsService: PlatformUtilsService,
    private apiService: ApiService,
    private logService: LogService,
    private collectionAdminService: CollectionAdminService,
    private router: Router
  ) {}

  /**
   * The id of the organization that is currently being filtered on.
   * This can come from a collection filter, organization filter, or the current organization when viewed
   * in the organization admin console and no other filters are applied.
   */
  get activeOrganizationId() {
    if (this.activeFilter.selectedCollectionNode != null) {
      return this.activeFilter.selectedCollectionNode.node.organizationId;
    }
    if (this.activeFilter.selectedOrganizationNode != null) {
      return this.activeFilter.selectedOrganizationNode.node.id;
    }
    return this.organization.id;
  }

  get title() {
    if (this.activeFilter.isCollectionSelected) {
      return this.activeFilter.selectedCollectionNode.node.name;
    }
    if (this.activeFilter.isUnassignedCollectionSelected) {
      return this.i18nService.t("unassigned");
    }
    return `${this.organization.name} ${this.i18nService.t("vault").toLowerCase()}`;
  }

  private showFreeOrgUpgradeDialog(): void {
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.i18nService.t(
        this.organization.canManageBilling
          ? "freeOrgMaxCollectionReachedManageBilling"
          : "freeOrgMaxCollectionReachedNoManageBilling",
        this.organization.maxCollections
      ),
      type: SimpleDialogType.PRIMARY,
    };

    if (this.organization.canManageBilling) {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("upgrade");
    } else {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("ok");
      orgUpgradeSimpleDialogOpts.cancelButtonText = null; // hide secondary btn
    }

    const simpleDialog = this.dialogService.openSimpleDialog(orgUpgradeSimpleDialogOpts);

    firstValueFrom(simpleDialog.closed).then((result: SimpleDialogCloseType | undefined) => {
      if (!result) {
        return;
      }

      if (result == SimpleDialogCloseType.ACCEPT && this.organization.canManageBilling) {
        this.router.navigate(["/organizations", this.organization.id, "billing", "subscription"], {
          queryParams: { upgrade: true },
        });
      }
    });
  }

  applyCollectionFilter(collection: TreeNode<CollectionFilter>) {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedCollectionNode = collection;
    this.activeFilterChanged.emit(filter);
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

  addCipher() {
    this.onAddCipher.emit();
  }

  async addCollection() {
    if (this.organization.planProductType === ProductType.Free) {
      const collections = await this.collectionAdminService.getAll(this.organization.id);
      if (collections.length === this.organization.maxCollections) {
        this.showFreeOrgUpgradeDialog();
        return;
      }
    }

    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: this.organization?.id,
        parentCollectionId: this.activeFilter.collectionId as Guid,
      },
    });
    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionDialogResult.Saved || result === CollectionDialogResult.Deleted) {
      this.onCollectionChanged.emit(null);
    }
  }

  async editCollection(c: CollectionView, tab: "info" | "access"): Promise<void> {
    const tabType = tab == "info" ? CollectionDialogTabType.Info : CollectionDialogTabType.Access;

    const dialog = openCollectionDialog(this.dialogService, {
      data: { collectionId: c?.id, organizationId: this.organization?.id, initialTab: tabType },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionDialogResult.Saved || result === CollectionDialogResult.Deleted) {
      this.onCollectionChanged.emit(c);
    }
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
      !this.organization.canDeleteAnyCollection &&
      !this.organization.canDeleteAssignedCollections
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
      this.onCollectionChanged.emit(collection);
    } catch (e) {
      this.logService.error(e);
    }
  }
}
