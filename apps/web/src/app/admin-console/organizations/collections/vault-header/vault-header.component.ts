import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CollectionAdminView,
  Unassigned,
} from "@bitwarden/common/admin-console/models/collections";
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
  IconModule,
} from "@bitwarden/components";
import { NewCipherMenuComponent, All, RoutedVaultFilterModel } from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared";
import { CollectionDialogTabType } from "../../shared/components/collection-dialog";

@Component({
  selector: "app-org-vault-header",
  templateUrl: "./vault-header.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MenuModule,
    SharedModule,
    BreadcrumbsModule,
    HeaderModule,
    SearchModule,
    JslibModule,
    NewCipherMenuComponent,
    IconModule,
  ],
})
export class VaultHeaderComponent {
  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);

  protected readonly All = All;
  protected readonly Unassigned = Unassigned;
  protected readonly CollectionDialogTabType = CollectionDialogTabType;
  protected readonly CipherType = CipherType;

  /**
   * Boolean to determine the loading state of the header.
   * Shows a loading spinner if set to true
   */
  readonly loading = input<boolean>(false);

  /** Current active filter */
  readonly filter = input.required<RoutedVaultFilterModel>();

  /** The organization currently being viewed */
  readonly organization = input.required<Organization>();

  /** Currently selected collection */
  readonly collection = input<TreeNode<CollectionAdminView> | undefined>(undefined);

  /** The current search text in the header */
  readonly searchText = input<string>("");

  /** Emits an event when the new item button is clicked in the header */
  readonly addCipher = output<CipherType | undefined>();

  /** Emits an event when the new collection button is clicked in the header */
  readonly addCollection = output<void>();

  /** Emits an event when the edit collection button is clicked in the header */
  readonly editCollection = output<{ tab: CollectionDialogTabType; readonly: boolean }>();

  /** Emits an event when the delete collection button is clicked in the header */
  readonly deleteCollection = output<void>();

  /** Emits an event when the search text changes in the header*/
  readonly searchTextChanged = output<string>();

  /** Emits an event when the add item dialog should be opened */
  readonly openAddItemDialogEvent = output();

  protected readonly title = computed(() => {
    const headerType = this.i18nService.t("collections").toLowerCase();

    const collection = this.collection();
    if (collection != null) {
      return collection.node.name;
    }

    if (this.filter().collectionId === Unassigned) {
      return this.i18nService.t("unassigned");
    }

    return this.organization().name
      ? `${this.organization().name} ${headerType}`
      : this.i18nService.t("collections");
  });

  protected readonly icon = computed(() =>
    this.filter().collectionId !== undefined ? "bwi-collection-shared" : "",
  );

  protected readonly showBreadcrumbs = computed(
    () => this.filter().collectionId !== undefined && this.filter().collectionId !== All,
  );

  /**
   * A list of collection filters that form a chain from the organization root to currently selected collection.
   * Begins from the organization root and excludes the currently selected collection.
   */
  protected readonly collections = computed<CollectionAdminView[]>(() => {
    const collection = this.collection();
    if (collection == undefined) {
      return [];
    }

    const nodes: TreeNode<CollectionAdminView>[] = [collection];
    let current: TreeNode<CollectionAdminView> = collection;
    while (current.parent != undefined) {
      current = current.parent;
      nodes.push(current);
    }

    return nodes
      .slice(1)
      .reverse()
      .map((treeNode) => treeNode.node);
  });

  private async showFreeOrgUpgradeDialog(): Promise<void> {
    const org = this.organization();
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.i18nService.t(
        org.canEditSubscription
          ? "freeOrgMaxCollectionReachedManageBilling"
          : "freeOrgMaxCollectionReachedNoManageBilling",
        org.maxCollections,
      ),
      type: "primary",
    };

    if (org.canEditSubscription) {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("upgrade");
    } else {
      orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("ok");
      orgUpgradeSimpleDialogOpts.cancelButtonText = null; // hide secondary btn
    }

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);
    const result = await firstValueFrom(simpleDialog.closed);

    if (result && org.canEditSubscription) {
      await this.router.navigate(["/organizations", org.id, "billing", "subscription"], {
        queryParams: { upgrade: true },
      });
    }
  }

  protected readonly canEditCollection = computed(() => {
    // Only edit collections if not editing "Unassigned"
    const collection = this.collection();
    if (collection === undefined) {
      return false;
    }

    // Otherwise, check if we can edit the specified collection
    return collection.node.canEdit(this.organization());
  });

  handleAddCipher(cipherType?: CipherType) {
    this.addCipher.emit(cipherType);
  }

  protected openAddItemDialog(): void {
    this.openAddItemDialogEvent.emit();
  }

  async handleAddCollection() {
    const org = this.organization();
    if (org.productTierType === ProductTierType.Free) {
      const collections = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) => this.collectionAdminService.collectionAdminViews$(org.id, userId)),
        ),
      );
      if (collections.length === org.maxCollections) {
        await this.showFreeOrgUpgradeDialog();
        return;
      }
    }

    this.addCollection.emit();
  }

  async handleEditCollection(tab: CollectionDialogTabType, readonly: boolean): Promise<void> {
    this.editCollection.emit({ tab, readonly });
  }

  protected readonly canDeleteCollection = computed(() => {
    // Only delete collections if not deleting "Unassigned"
    const collection = this.collection();
    if (collection === undefined) {
      return false;
    }

    // Otherwise, check if we can delete the specified collection
    return collection.node.canDelete(this.organization());
  });

  protected readonly canViewCollectionInfo = computed(
    () => this.collection()?.node.canViewCollectionInfo(this.organization()) ?? false,
  );

  protected readonly canCreateCollection = computed(
    () => this.organization()?.canCreateNewCollections,
  );

  protected readonly canCreateCipher = computed(() => {
    const org = this.organization();
    if (org?.isProviderUser && !org?.isMember) {
      return false;
    }
    return true;
  });

  handleDeleteCollection() {
    this.deleteCollection.emit();
  }

  onSearchTextChanged(t: string) {
    this.searchTextChanged.emit(t);
  }
}
