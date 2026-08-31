import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, firstValueFrom, lastValueFrom, map, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionData,
  CollectionDetailsResponse,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { DialogService, ToastService } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";
import {
  BULK_DELETE_DIALOG,
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  BulkDeleteDialogRef,
  BulkEditCollectionAccessDialogRef,
  parseVaultScope,
  SharedFolderCollectionRow,
  sharedFolderRows,
  SharedFoldersTableBulkAction,
  SharedFoldersTableComponent,
  SharedFoldersTableRowAction,
  VaultScopeType,
} from "@bitwarden/vault";

import { BulkEditCollectionAccessWebDialogAdapter } from "../../../admin-console/organizations/collections/bulk-collections-dialog/bulk-edit-collection-access-web-dialog.adapter";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../../admin-console/organizations/shared/components/collection-dialog";
import { HeaderModule } from "../../../layouts/header/header.module";
import { BulkDeleteDialogWebAdapter } from "../bulk-action-dialogs/bulk-delete-dialog-web.adapter";
import { openDeleteSharedFolderDialog } from "../bulk-action-dialogs/delete-shared-folder-dialog/delete-shared-folder-dialog.component";

/**
 * The shared folders of one organization vault, listed in the shared
 * {@link SharedFoldersTableComponent}.
 *
 * A sibling of the item list rather than a mode of it: `VaultNextComponent` shows ciphers, and
 * nothing it derives from them applies here. The two pages share the vault scope and the
 * `:vaultId` segment, and nothing else.
 *
 * Reached at `/vault/:vaultId/shared-folders`, guarded by `organizationVaultGuard` — see the route
 * in `VaultRoutingModule`.
 */
@Component({
  selector: "app-shared-folders",
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0",
  },
  imports: [HeaderModule, SharedFoldersTableComponent],
  providers: [
    safeProvider({
      provide: BULK_DELETE_DIALOG,
      useClass: BulkDeleteDialogWebAdapter,
      useAngularDecorators: true,
    }),
    safeProvider({
      provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG,
      useClass: BulkEditCollectionAccessWebDialogAdapter,
      useAngularDecorators: true,
    }),
  ],
})
export class SharedFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly bulkDeleteDialog = inject<BulkDeleteDialogRef>(BULK_DELETE_DIALOG);
  private readonly bulkEditAccessDialog = inject<BulkEditCollectionAccessDialogRef>(
    BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  );
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly organizationService = inject(OrganizationService);
  private readonly syncService = inject(SyncService);
  private readonly toastService = inject(ToastService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly routeParams = toSignal(this.activatedRoute.paramMap);

  /**
   * The organization whose folders this page lists. `organizationVaultGuard` has already turned
   * away any other segment, so `undefined` means the guard was bypassed — the page then lists
   * nothing rather than falling back to a vault the URL did not ask for.
   */
  private readonly organizationId = computed<OrganizationId | undefined>(() => {
    const scope = parseVaultScope(this.routeParams()?.get("vaultId"));
    return scope?.type === VaultScopeType.Organization ? scope.organizationId : undefined;
  });

  /** `undefined` until each stream first emits, which is what drives {@link loading}. */
  private readonly loaded = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        combineLatest([
          this.collectionService.decryptedCollections$(userId),
          // Emits null until the first decrypt completes.
          this.cipherService.cipherListViews$(userId).pipe(filterOutNullish()),
          this.organizationService.organizations$(userId),
        ]),
      ),
      map(([collections, ciphers, organizations]) => ({ collections, ciphers, organizations })),
    ),
  );

  protected readonly loading = computed(() => this.loaded() === undefined);

  private readonly organization = computed<Organization | undefined>(() =>
    this.loaded()?.organizations.find((organization) => organization.id === this.organizationId()),
  );

  /**
   * Placeholder header title, matching `VaultNextComponent` — breadcrumbs replace this. `undefined`
   * leaves the route's own `titleId` in place while the organization list loads.
   */
  protected readonly title = computed(() => this.organization()?.name);

  /** The organization's shared folders — see {@link sharedFolderRows}. */
  protected readonly sharedFolders = computed<SharedFolderCollectionRow[]>(() => {
    const organizationId = this.organizationId();
    const data = this.loaded();
    if (organizationId == null || data == null) {
      return [];
    }

    return sharedFolderRows({
      organizationId,
      organization: this.organization(),
      collections: data.collections,
      ciphers: data.ciphers,
    });
  });

  /**
   * Whether the table offers its Add button, on the organization's own collection creation
   * permission — so this page and the organization vault's Add agree on who may add a folder.
   * `false` while the organization list loads, and for a `:vaultId` that resolves to nothing:
   * either way the dialog would have no organization to save to.
   */
  protected readonly canAdd = computed(() => this.organization()?.canCreateNewCollections ?? false);

  protected readonly rowActions = computed<
    SharedFoldersTableRowAction<SharedFolderCollectionRow>[]
  >(() => {
    const organization = this.organization();

    return [
      {
        id: "edit",
        label: this.i18nService.t("edit"),
        icon: "bwi-pencil-square",
        show: (row) => row.collection.canEdit(organization),
        run: (row) => this.editSharedFolder(row.collection, CollectionDialogTabType.Info),
      },
      {
        id: "access",
        label: this.i18nService.t("access"),
        icon: "bwi-users",
        show: (row) => row.collection.canEdit(organization),
        run: (row) => this.editSharedFolder(row.collection, CollectionDialogTabType.Access),
      },
      {
        id: "delete",
        label: this.i18nService.t("delete"),
        icon: "bwi-trash",
        variant: "danger",
        show: (row) => row.collection.canDelete(organization),
        run: (row) => this.deleteSharedFolder(row.collection),
      },
    ];
  });

  /**
   * The bulk actions bar's actions — and, since the table only shows checkboxes once it has an
   * action to run, what turns row selection on at all. Mirrors the organization vault's batch bar
   * for a collections-only selection.
   *
   * An action is left out entirely when the member can perform it on none of the listed folders: a
   * permanently disabled button is worth less than the checkbox column it would cost.
   */
  protected readonly bulkActions = computed<
    SharedFoldersTableBulkAction<SharedFolderCollectionRow>[]
  >(() => {
    const organization = this.organization();
    const rows = this.sharedFolders();
    const actions: SharedFoldersTableBulkAction<SharedFolderCollectionRow>[] = [];

    // Both dialogs re-check the batch and refuse it whole; disabling says so before the click.
    if (rows.some((row) => row.collection.canEdit(organization))) {
      actions.push({
        id: "edit-access",
        label: this.i18nService.t("editAccess"),
        icon: "bwi-users",
        disabled: (selected) => selected.some((row) => !row.collection.canEdit(organization)),
        run: (selected) => this.editSharedFoldersAccess(selected.map((row) => row.collection)),
      });
    }

    if (rows.some((row) => row.collection.canDelete(organization))) {
      actions.push({
        id: "delete",
        label: this.i18nService.t("delete"),
        icon: "bwi-trash",
        disabled: (selected) => selected.some((row) => !row.collection.canDelete(organization)),
        run: (selected) => this.deleteSharedFolders(selected.map((row) => row.collection)),
      });
    }

    return actions;
  });

  protected async addSharedFolder(): Promise<void> {
    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }

    // The route fixes the organization, so unlike the legacy vault's Add there's no org selector.
    const dialog = openCollectionDialog(this.dialogService, {
      data: { organizationId, limitNestedCollections: true },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result?.action !== CollectionDialogAction.Saved) {
      return;
    }

    await this.upsertCollection(result.collection);
  }

  private async editSharedFolder(
    collection: CollectionView,
    initialTab: CollectionDialogTabType,
  ): Promise<void> {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        collectionId: collection.id,
        organizationId: collection.organizationId,
        initialTab,
        limitNestedCollections: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === undefined) {
      return;
    }

    if (result.action === CollectionDialogAction.Saved) {
      await this.upsertCollection(result.collection);
    } else if (result.action === CollectionDialogAction.Deleted && result.collection != null) {
      const userId = await firstValueFrom(this.userId$);
      await this.collectionService.delete([result.collection.id as CollectionView["id"]], userId);
    }
  }

  private async deleteSharedFolder(collection: CollectionView): Promise<void> {
    const confirmed = await lastValueFrom(
      openDeleteSharedFolderDialog(this.dialogService, collection.name).closed,
    );
    if (!confirmed) {
      return;
    }

    await this.apiService.deleteCollection(collection.organizationId, collection.id);

    const userId = await firstValueFrom(this.userId$);
    await this.collectionService.delete([collection.id], userId);

    // Deleting a folder alters the items in it, so the whole vault resyncs, not just collections.
    await this.syncService.fullSync(true);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("sharedFolderDeleted"),
    });
  }

  /**
   * Opens the shared access editor over every selected folder — the same dialog the organization
   * vault's Edit access reaches. It writes through `CollectionAdminService` and shows its own
   * toast, so nothing is written back here.
   */
  private async editSharedFoldersAccess(collections: CollectionView[]): Promise<void> {
    const organizationId = this.organizationId();
    if (organizationId == null || collections.length === 0) {
      return;
    }

    await this.bulkEditAccessDialog.open({ organizationId, collections });
  }

  /**
   * Deletes every selected folder through the shared bulk delete dialog, which owns the whole
   * sequence — confirmation, requests, resync, and toast. It clears the deleted folders from
   * `CollectionService`, so the table's stream re-emits without them.
   */
  private async deleteSharedFolders(collections: CollectionView[]): Promise<void> {
    const organization = this.organization();
    if (organization == null || collections.length === 0) {
      return;
    }

    // `organization` rather than `organizations`: the route scopes this page to a single org.
    await this.bulkDeleteDialog.open({ organization, collections });
  }

  /** Writes a saved folder back to `CollectionService`, so the table's stream re-emits with it. */
  private async upsertCollection(collection: unknown): Promise<void> {
    if (collection == null) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);
    await this.collectionService.upsert(
      new CollectionData(collection as CollectionDetailsResponse),
      userId,
    );
  }
}
