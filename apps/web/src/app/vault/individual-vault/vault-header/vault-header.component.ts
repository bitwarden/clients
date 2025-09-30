import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import {
  Unassigned,
  CollectionView,
  CollectionAdminService,
  CollectionTypes,
} from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import {
  BreadcrumbsModule,
  DialogService,
  MenuModule,
  SimpleDialogOptions,
} from "@bitwarden/components";
import { NewCipherMenuComponent } from "@bitwarden/vault";

import { CollectionDialogTabType } from "../../../admin-console/organizations/shared/components/collection-dialog";
import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { PipesModule } from "../pipes/pipes.module";
import {
  All,
  RoutedVaultFilterModel,
} from "../vault-filter/shared/models/routed-vault-filter.model";

@Component({
  selector: "app-vault-header",
  templateUrl: "./vault-header.component.html",
  imports: [
    CommonModule,
    MenuModule,
    SharedModule,
    BreadcrumbsModule,
    HeaderModule,
    PipesModule,
    JslibModule,
    NewCipherMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultHeaderComponent {
  protected Unassigned = Unassigned;
  protected All = All;
  protected CollectionDialogTabType = CollectionDialogTabType;
  protected CipherType = CipherType;

  /**
   * Boolean to determine the loading state of the header.
   * Shows a loading spinner if set to true
   */
  @Input() loading: boolean = true;

  /** Current active filter */
  @Input() filter: RoutedVaultFilterModel | undefined;

  /** All organizations that can be shown */
  @Input() organizations: Organization[] = [];

  /** Currently selected collection */
  @Input() collection?: TreeNode<CollectionView>;

  /** Whether 'Collection' option is shown in the 'New' dropdown */
  @Input() canCreateCollections: boolean = false;

  /** Emits an event when the new item button is clicked in the header */
  @Output() onAddCipher = new EventEmitter<CipherType | undefined>();

  /** Emits an event when the new collection button is clicked in the 'New' dropdown menu */
  @Output() onAddCollection = new EventEmitter<null>();

  /** Emits an event when the new folder button is clicked in the 'New' dropdown menu */
  @Output() onAddFolder = new EventEmitter<null>();

  /** Emits an event when the edit collection button is clicked in the header */
  @Output() onEditCollection = new EventEmitter<{ tab: CollectionDialogTabType }>();

  /** Emits an event when the delete collection button is clicked in the header */
  @Output() onDeleteCollection = new EventEmitter<void>();

  constructor(
    private i18nService: I18nService,
    private collectionAdminService: CollectionAdminService,
    private dialogService: DialogService,
    private router: Router,
    private configService: ConfigService,
    private accountService: AccountService,
  ) {}

  /**
   * The id of the organization that is currently being filtered on.
   * This can come from a collection filter or organization filter, if applied.
   */
  protected get activeOrganizationId() {
    if (this.collection != undefined) {
      return this.collection.node.organizationId;
    }

    if (this.filter?.organizationId !== undefined) {
      return this.filter.organizationId;
    }

    return undefined;
  }

  protected get activeOrganization() {
    const organizationId = this.activeOrganizationId;
    return this.organizations?.find((org) => org.id === organizationId);
  }

  protected get showBreadcrumbs() {
    return this.filter?.collectionId !== undefined && this.filter.collectionId !== All;
  }

  protected get title() {
    if (this.filter === undefined) {
      return "";
    }

    if (this.filter.collectionId === Unassigned) {
      return this.i18nService.t("unassigned");
    }

    if (this.collection) {
      return this.collection.node.name;
    }

    if (this.filter.organizationId === Unassigned) {
      return this.i18nService.t("myVault");
    }

    if (this.filter.type === "archive") {
      return this.i18nService.t("archive");
    }

    const activeOrganization = this.activeOrganization;
    if (activeOrganization) {
      return `${activeOrganization.name} ${this.i18nService.t("vault").toLowerCase()}`;
    }

    return this.i18nService.t("allVaults");
  }

  protected get icon() {
    if (!this.filter?.collectionId || this.filter.collectionId === All) {
      return "";
    }
    return this.collection?.node.type === CollectionTypes.DefaultUserCollection
      ? "bwi-user"
      : "bwi-collection-shared";
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

  get canEditCollection(): boolean {
    // Only edit collections if not editing "Unassigned"
    if (this.collection == null) {
      return false;
    }

    // Otherwise, check if we can edit the specified collection
    const organization = this.organizations.find(
      (o) => o.id === this.collection?.node.organizationId,
    );
    return this.collection.node.canEdit(organization);
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
    const organization = this.organizations.find(
      (o) => o.id === this.collection?.node.organizationId,
    );

    return this.collection.node.canDelete(organization);
  }

  deleteCollection() {
    this.onDeleteCollection.emit();
  }

  protected addCipher(cipherType?: CipherType) {
    this.onAddCipher.emit(cipherType);
  }

  async addFolder(): Promise<void> {
    this.onAddFolder.emit();
  }

  async addCollection(): Promise<void> {
    const organization = this.organizations?.find(
      (org) => org.productTierType === ProductTierType.Free,
    );

    if (this.organizations?.length == 1 && !!organization) {
      const collections = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) =>
            this.collectionAdminService.collectionAdminViews$(organization.id, userId),
          ),
        ),
      );
      if (collections.length === organization.maxCollections) {
        await this.showFreeOrgUpgradeDialog(organization);
        return;
      }
    }

    this.onAddCollection.emit();
  }

  private async showFreeOrgUpgradeDialog(organization: Organization): Promise<void> {
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.i18nService.t(
        organization.canEditSubscription
          ? "freeOrgMaxCollectionReachedManageBilling"
          : "freeOrgMaxCollectionReachedNoManageBilling",
        organization.maxCollections,
      ),
      type: "primary",
    };

    if (organization.canEditSubscription) {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("upgrade");
    } else {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("ok");
      orgUpgradeSimpleDialogOpts.cancelButtonText = null; // hide secondary btn
    }

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);
    const result: boolean | undefined = await firstValueFrom(simpleDialog.closed);

    if (!result) {
      return;
    }

    if (organization.canEditSubscription) {
      await this.router.navigate(["/organizations", organization.id, "billing", "subscription"], {
        queryParams: { upgrade: true },
      });
    }
  }
}
