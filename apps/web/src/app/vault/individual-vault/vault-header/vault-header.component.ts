// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map, shareReplay } from "rxjs";

import {
  Unassigned,
  CollectionView,
  CollectionAdminService,
} from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  BreadcrumbsModule,
  DialogService,
  MenuModule,
  SimpleDialogOptions,
} from "@bitwarden/components";

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultHeaderComponent {
  protected Unassigned = Unassigned;
  protected All = All;
  protected CollectionDialogTabType = CollectionDialogTabType;
  protected CipherType = CipherType;
  protected allCipherMenuItems = [
    { type: CipherType.Login, icon: "bwi-globe", labelKey: "typeLogin" },
    { type: CipherType.Card, icon: "bwi-credit-card", labelKey: "typeCard" },
    { type: CipherType.Identity, icon: "bwi-id-card", labelKey: "typeIdentity" },
    { type: CipherType.SecureNote, icon: "bwi-sticky-note", labelKey: "note" },
    { type: CipherType.SshKey, icon: "bwi-key", labelKey: "typeSshKey" },
  ];
  protected cipherMenuItems$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedTypes) => {
      return this.allCipherMenuItems.filter((item) => {
        return !restrictedTypes.some((restrictedType) => restrictedType.cipherType === item.type);
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Boolean to determine the loading state of the header.
   * Shows a loading spinner if set to true
   */
  @Input() loading: boolean;

  /** Current active filter */
  @Input() filter: RoutedVaultFilterModel;

  /** All organizations that can be shown */
  @Input() organizations: Organization[] = [];

  /** Currently selected collection */
  @Input() collection?: TreeNode<CollectionView>;

  /** Whether 'Collection' option is shown in the 'New' dropdown */
  @Input() canCreateCollections: boolean;

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
    private restrictedItemTypesService: RestrictedItemTypesService,
  ) {}

  /**
   * The id of the organization that is currently being filtered on.
   * This can come from a collection filter or organization filter, if applied.
   */
  protected get activeOrganizationId() {
    if (this.collection != undefined) {
      return this.collection.node.organizationId;
    }

    if (this.filter.organizationId !== undefined) {
      return this.filter.organizationId;
    }

    return undefined;
  }

  protected get activeOrganization() {
    const organizationId = this.activeOrganizationId;
    return this.organizations?.find((org) => org.id === organizationId);
  }

  protected get showBreadcrumbs() {
    return this.filter.collectionId !== undefined && this.filter.collectionId !== All;
  }

  protected get title() {
    if (this.filter.collectionId === Unassigned) {
      return this.i18nService.t("unassigned");
    }

    if (this.collection) {
      return this.collection.node.name;
    }

    if (this.filter.organizationId === Unassigned) {
      return this.i18nService.t("myVault");
    }

    const activeOrganization = this.activeOrganization;
    if (activeOrganization) {
      return `${activeOrganization.name} ${this.i18nService.t("vault").toLowerCase()}`;
    }

    return this.i18nService.t("allVaults");
  }

  protected get icon() {
    return this.filter.collectionId && this.filter.collectionId !== All
      ? "bwi-collection-shared"
      : "";
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
    const isBreadcrumbEventLogsEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.PM12276_BreadcrumbEventLogs),
    );

    if (isBreadcrumbEventLogsEnabled) {
      const organization = this.organizations?.find(
        (org) => org.productTierType === ProductTierType.Free,
      );

      if (this.organizations?.length == 1 && !!organization) {
        const collections = await this.collectionAdminService.getAll(organization.id);
        if (collections.length === organization.maxCollections) {
          await this.showFreeOrgUpgradeDialog(organization);
          return;
        }
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
