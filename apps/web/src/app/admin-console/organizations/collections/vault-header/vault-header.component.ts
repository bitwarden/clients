// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME: rename output bindings and then remove this line
/* eslint-disable @angular-eslint/no-output-on-prefix */
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import {
  CollectionAdminService,
  CollectionAdminView,
  Unassigned,
} from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import {
  BreadcrumbsModule,
  DialogService,
  MenuModule,
  SearchModule,
  SimpleDialogOptions,
} from "@bitwarden/components";
import { NewCipherMenuComponent } from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared";
import {
  All,
  RoutedVaultFilterModel,
} from "../../../../vault/individual-vault/vault-filter/shared/models/routed-vault-filter.model";
import { CollectionDialogTabType } from "../../shared/components/collection-dialog";

@Component({
  selector: "app-org-vault-header",
  templateUrl: "./vault-header.component.html",
  imports: [
    CommonModule,
    MenuModule,
    SharedModule,
    BreadcrumbsModule,
    HeaderModule,
    SearchModule,
    JslibModule,
    NewCipherMenuComponent,
  ],
})
export class VaultHeaderComponent {
  protected All = All;
  protected Unassigned = Unassigned;

  /**
   * Boolean to determine the loading state of the header.
   * Shows a loading spinner if set to true
   */
  @Input() loading: boolean;

  /** Current active filter */
  @Input() filter: RoutedVaultFilterModel;

  /** The organization currently being viewed */
  @Input() organization: Organization;

  /** Currently selected collection */
  @Input() collection?: TreeNode<CollectionAdminView>;

  /** The current search text in the header */
  @Input() searchText: string;

  /** Emits an event when the new item button is clicked in the header */
  @Output() onAddCipher = new EventEmitter<CipherType | undefined>();

  /** Emits an event when the new collection button is clicked in the header */
  @Output() onAddCollection = new EventEmitter<void>();

  /** Emits an event when the edit collection button is clicked in the header */
  @Output() onEditCollection = new EventEmitter<{
    tab: CollectionDialogTabType;
    readonly: boolean;
  }>();

  /** Emits an event when the delete collection button is clicked in the header */
  @Output() onDeleteCollection = new EventEmitter<void>();

  /** Emits an event when the search text changes in the header*/
  @Output() searchTextChanged = new EventEmitter<string>();

  protected CollectionDialogTabType = CollectionDialogTabType;

  /** The cipher type enum. */
  protected CipherType = CipherType;

  constructor(
    private i18nService: I18nService,
    private dialogService: DialogService,
    private collectionAdminService: CollectionAdminService,
    private router: Router,
    private accountService: AccountService,
  ) {}

  get title() {
    const headerType = this.i18nService.t("collections").toLowerCase();

    if (this.collection != null) {
      return this.collection.node.name;
    }

    if (this.filter.collectionId === Unassigned) {
      return this.i18nService.t("unassigned");
    }

    return this.organization?.name
      ? `${this.organization?.name} ${headerType}`
      : this.i18nService.t("collections");
  }

  get icon() {
    return this.filter.collectionId !== undefined ? "bwi-collection-shared" : "";
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
        this.organization.maxCollections,
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

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    firstValueFrom(simpleDialog.closed).then((result: boolean | undefined) => {
      if (!result) {
        return;
      }

      if (result && this.organization.canEditSubscription) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    return this.collection.node.canEdit(this.organization);
  }

  addCipher(cipherType?: CipherType) {
    this.onAddCipher.emit(cipherType);
  }

  async addCollection() {
    if (this.organization.productTierType === ProductTierType.Free) {
      const collections = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) =>
            this.collectionAdminService.collectionAdminViews$(this.organization.id, userId),
          ),
        ),
      );
      if (collections.length === this.organization.maxCollections) {
        this.showFreeOrgUpgradeDialog();
        return;
      }
    }

    this.onAddCollection.emit();
  }

  async editCollection(tab: CollectionDialogTabType, readonly: boolean): Promise<void> {
    this.onEditCollection.emit({ tab, readonly });
  }

  get canDeleteCollection(): boolean {
    // Only delete collections if not deleting "Unassigned"
    if (this.collection === undefined) {
      return false;
    }

    // Otherwise, check if we can delete the specified collection
    return this.collection.node.canDelete(this.organization);
  }

  get canViewCollectionInfo(): boolean {
    return this.collection.node.canViewCollectionInfo(this.organization);
  }

  get canCreateCollection(): boolean {
    return this.organization?.canCreateNewCollections;
  }

  get canCreateCipher(): boolean {
    if (this.organization?.isProviderUser && !this.organization?.isMember) {
      return false;
    }
    return true;
  }

  deleteCollection() {
    this.onDeleteCollection.emit();
  }

  onSearchTextChanged(t: string) {
    this.searchText = t;
    this.searchTextChanged.emit(t);
  }
}
