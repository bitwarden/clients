import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";

import { CollectionDialogTabType } from "../../components/collection-dialog";
import {
  All,
  RoutedVaultFilterModel,
  Unassigned,
} from "../vault-filter/shared/models/routed-vault-filter.model";

@Component({
  selector: "app-vault-header",
  templateUrl: "./vault-header.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultHeaderComponent implements OnInit {
  protected Unassigned = Unassigned;
  protected All = All;
  protected CollectionDialogTabType = CollectionDialogTabType;

  private flexibleCollectionsEnabled: boolean;

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
  @Output() onAddCipher = new EventEmitter<void>();

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
    private configService: ConfigServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.flexibleCollectionsEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.FlexibleCollections,
    );
  }

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
    if (this.collection === undefined) {
      return false;
    }

    // Otherwise, check if we can edit the specified collection
    const organization = this.organizations.find(
      (o) => o.id === this.collection?.node.organizationId,
    );
    return this.collection.node.canEdit(organization, this.flexibleCollectionsEnabled);
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

    return this.collection.node.canDelete(organization, this.flexibleCollectionsEnabled);
  }

  deleteCollection() {
    this.onDeleteCollection.emit();
  }

  protected addCipher() {
    this.onAddCipher.emit();
  }

  async addFolder(): Promise<void> {
    this.onAddFolder.emit();
  }

  async addCollection(): Promise<void> {
    this.onAddCollection.emit();
  }
}
