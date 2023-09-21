import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductType } from "@bitwarden/common/enums";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

import { CollectionAdminView } from "../../../vault/core/views/collection-admin.view";
import { CollectionDialogTabType } from "../../components/collection-dialog";
import { CollectionAdminService } from "../../core/collection-admin.service";
import {
  All,
  RoutedVaultFilterModel,
  Unassigned,
} from "../../individual-vault/vault-filter/shared/models/routed-vault-filter.model";

@Component({
  selector: "app-org-vault-header",
  templateUrl: "./vault-header.component.html",
})
export class VaultHeaderComponent {
  protected All = All;
  protected Unassigned = Unassigned;

  /**
   * Boolean to determine the loading state of the header.
   * Shows a loading spinner if set to true
   */
  @Input() loading: boolean;

  /** Current active fitler */
  @Input() filter: RoutedVaultFilterModel;

  /** The organization currently being viewed */
  @Input() organization: Organization;

  /** Currently selected collection */
  @Input() collection?: TreeNode<CollectionAdminView>;

  /** Emits an event when the new item button is clicked in the header */
  @Output() onAddCipher = new EventEmitter<void>();

  /** Emits an event when the new collection button is clicked in the header */
  @Output() onAddCollection = new EventEmitter<void>();

  /** Emits an event when the edit collection button is clicked in the header */
  @Output() onEditCollection = new EventEmitter<{ tab: CollectionDialogTabType }>();

  /** Emits an event when the delete collection button is clicked in the header */
  @Output() onDeleteCollection = new EventEmitter<void>();

  protected CollectionDialogTabType = CollectionDialogTabType;
  protected organizations$ = this.organizationService.organizations$;

  constructor(
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private collectionAdminService: CollectionAdminService,
    private router: Router
  ) {}

  get title() {
    if (this.collection !== undefined) {
      return this.collection.node.name;
    }

    if (this.filter.collectionId === Unassigned) {
      return this.i18nService.t("unassigned");
    }

    return `${this.organization.name} ${this.i18nService.t("vault").toLowerCase()}`;
  }

  protected get showBreadcrumbs() {
    return this.filter.collectionId !== undefined && this.filter.collectionId !== All;
  }

  /**
   * A list of collection filters that form a chain from the organization root to currently selected collection.
   * Begins from the organization root and excludes the currently selected collection.
   */
  protected get collections() {
    if (this.collection == undefined) {
      return [];
    }

    const collections = [this.collection];
    while (collections[collections.length - 1].parent != undefined) {
      collections.push(collections[collections.length - 1].parent);
    }

    return collections
      .slice(1)
      .reverse()
      .map((treeNode) => treeNode.node);
  }

  private showFreeOrgUpgradeDialog(): void {
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.i18nService.t(
        this.organization.canEditSubscription
          ? "freeOrgMaxCollectionReachedManageBilling"
          : "freeOrgMaxCollectionReachedNoManageBilling",
        this.organization.maxCollections
      ),
      type: "primary",
    };

    if (this.organization.canEditSubscription) {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("upgrade");
    } else {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("ok");
      orgUpgradeSimpleDialogOpts.cancelButtonText = null; // hide secondary btn
    }

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);

    firstValueFrom(simpleDialog.closed).then((result: boolean | undefined) => {
      if (!result) {
        return;
      }

      if (result && this.organization.canEditSubscription) {
        this.router.navigate(["/organizations", this.organization.id, "billing", "subscription"], {
          queryParams: { upgrade: true },
        });
      }
    });
  }

  get canEditCollection(): boolean {
    // Only edit collections if not editing "Unassigned"
    if (this.collection === undefined) {
      return false;
    }

    // Otherwise, check if we can edit the specified collection
    return (
      this.organization.canEditAnyCollection ||
      (this.organization.canEditAssignedCollections && this.collection?.node.assigned)
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

    this.onAddCollection.emit();
  }

  async editCollection(tab: CollectionDialogTabType): Promise<void> {
    this.onEditCollection.emit({ tab });
  }

  get canDeleteCollection(): boolean {
    // Only delete collections if not deleting "Unassigned"
    if (this.collection === undefined) {
      return false;
    }

    // Otherwise, check if we can delete the specified collection
    return (
      this.organization?.canDeleteAnyCollection ||
      (this.organization?.canDeleteAssignedCollections && this.collection.node.assigned)
    );
  }

  deleteCollection() {
    this.onDeleteCollection.emit();
  }
}
