import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, Observable } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionAdminView , CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogService, ToastService } from "@bitwarden/components";

import { CollectionPermission } from "../../shared/components/access-selector";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../shared/components/collection-dialog";
import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "../bulk-collections-dialog";

@Injectable()
export class VaultCollectionActionsService {
  private organization$!: Observable<Organization>;
  private userId$!: Observable<UserId>;
  private selectedCollection$!: Observable<TreeNode<CollectionAdminView> | undefined>;
  private editableCollections$!: Observable<CollectionAdminView[]>;
  private refreshCallback!: () => void;

  constructor(
    private apiService: ApiService,
    private collectionService: CollectionService,
    private cipherService: CipherService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private logService: LogService,
    private i18nService: I18nService,
    private router: Router,
  ) {}

  init(
    organization$: Observable<Organization>,
    userId$: Observable<UserId>,
    selectedCollection$: Observable<TreeNode<CollectionAdminView> | undefined>,
    editableCollections$: Observable<CollectionAdminView[]>,
    refresh: () => void,
  ): void {
    this.organization$ = organization$;
    this.userId$ = userId$;
    this.selectedCollection$ = selectedCollection$;
    this.editableCollections$ = editableCollections$;
    this.refreshCallback = refresh;
  }

  private refresh(): void {
    this.refreshCallback();
  }

  async addCollection(): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const selectedCollection = await firstValueFrom(this.selectedCollection$);
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: organization.id,
        parentCollectionId: selectedCollection?.node.id,
        limitNestedCollections: !organization.canEditAnyCollection,
        isAdminConsoleActive: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (
      result?.action === CollectionDialogAction.Saved ||
      result?.action === CollectionDialogAction.Deleted
    ) {
      this.refresh();
    }
  }

  async editCollection(
    c: CollectionAdminView,
    tab: CollectionDialogTabType,
    readonly: boolean,
    initialPermission?: CollectionPermission,
  ): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        collectionId: c.id,
        organizationId: organization.id,
        initialTab: tab,
        readonly: readonly,
        isAddAccessCollection: c.unmanaged,
        limitNestedCollections: !organization.canEditAnyCollection,
        isAdminConsoleActive: true,
        initialPermission,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (
      result?.action === CollectionDialogAction.Saved ||
      result?.action === CollectionDialogAction.Deleted
    ) {
      this.refresh();

      const selectedCollection = await firstValueFrom(this.selectedCollection$);
      // If we deleted the selected collection, navigate up/away
      if (
        result.action === CollectionDialogAction.Deleted &&
        selectedCollection?.node.id === c.id
      ) {
        void this.router.navigate([], {
          queryParams: { collectionId: selectedCollection.parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
    }
  }

  async deleteCollection(collection: CollectionAdminView): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const userId = await firstValueFrom(this.userId$);
    if (!collection.canDelete(organization)) {
      this.showMissingPermissionsError();
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: collection.name,
      content: { key: "deleteCollectionConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }
    try {
      await this.apiService.deleteCollection(organization.id, collection.id);
      await this.collectionService.delete([collection.id] as CollectionId[], userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deletedCollectionId", collection.name),
      });

      // Clear the cipher cache to clear the deleted collection from the cipher state
      await this.cipherService.clear();

      // Navigate away if we deleted the collection we were viewing
      const selectedCollection = await firstValueFrom(this.selectedCollection$);
      if (selectedCollection?.node.id === collection.id) {
        void this.router.navigate([], {
          queryParams: { collectionId: selectedCollection?.parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }

      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkEditCollectionAccess(
    collections: CollectionView[],
    organization: Organization,
  ): Promise<void> {
    if (collections.length === 0) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("noCollectionsSelected"),
      });
      return;
    }

    if (collections.some((c) => !c.canEdit(organization))) {
      this.showMissingPermissionsError();
      return;
    }

    const org = await firstValueFrom(this.organization$);
    const dialog = BulkCollectionsDialogComponent.open(this.dialogService, {
      data: {
        collections,
        organizationId: org.id,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkCollectionsDialogResult.Saved) {
      this.refresh();
    }
  }

  private showMissingPermissionsError(): void {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("missingPermissions"),
    });
  }
}
