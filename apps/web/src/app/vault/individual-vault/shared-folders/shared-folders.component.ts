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
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  cipherInScope,
  parseVaultScope,
  SharedFolderPermission,
  SharedFolderRow,
  SharedFoldersTableComponent,
  SharedFoldersTableRowAction,
  VaultScope,
  VaultScopeType,
} from "@bitwarden/vault";

import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../../admin-console/organizations/shared/components/collection-dialog";
import { HeaderModule } from "../../../layouts/header/header.module";
import { openDeleteSharedFolderDialog } from "../bulk-action-dialogs/delete-shared-folder-dialog/delete-shared-folder-dialog.component";

/**
 * The row the table is handed, carrying the `CollectionView` it was built from so the row actions
 * can act on the folder without looking it up again. The table is generic over anything assignable
 * to {@link SharedFolderRow}, so the extra field stays typed through to each action's `run`.
 */
type WebSharedFolderRow = SharedFolderRow & { collection: CollectionView };

/**
 * The shared folders of one organization vault, listed in the shared
 * {@link SharedFoldersTableComponent}.
 *
 * A sibling of the item list rather than a mode of it — `VaultNextComponent` shows the ciphers of
 * whatever vault the URL scopes to, and none of what it derives from them applies here. The two
 * pages share the vault scope and the `:vaultId` segment that names it, and nothing else.
 *
 * Reached at `/vault/:vaultId/shared-folders`, guarded to organization vaults by
 * `organizationVaultGuard` — see the route in `VaultRoutingModule`, which must stay declared above
 * `:vaultId/:collectionId`.
 */
@Component({
  selector: "app-shared-folders",
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0",
  },
  imports: [HeaderModule, SharedFoldersTableComponent],
})
export class SharedFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
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
   * away any segment that names something other than an organization vault, so `undefined` here
   * means the guard was bypassed — the page then lists nothing rather than falling back to a vault
   * the URL did not ask for.
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

  /**
   * The organization's shared folders, with each folder's permission and item count resolved.
   *
   * The organization's "My items" collection is left out: it is the member's own default
   * collection rather than a folder shared with anyone, and the side nav already offers it as its
   * own destination.
   */
  protected readonly sharedFolders = computed<WebSharedFolderRow[]>(() => {
    const organizationId = this.organizationId();
    const data = this.loaded();
    if (organizationId == null || data == null) {
      return [];
    }

    const organization = this.organization();

    return data.collections
      .filter(
        (collection) =>
          collection.organizationId === organizationId && !collection.isDefaultCollection,
      )
      .map((collection) => ({
        id: collection.id,
        organizationId: collection.organizationId,
        name: collection.name,
        permissions: resolvePermission(collection, organization),
        items: countItems(data.ciphers, organizationId, collection),
        collection,
      }));
  });

  protected readonly rowActions = computed<SharedFoldersTableRowAction<WebSharedFolderRow>[]>(
    () => {
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
    },
  );

  protected async addSharedFolder(): Promise<void> {
    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }

    // The organization is fixed by the route, so unlike the legacy vault's Add there is no
    // org selector to offer and no default to pick.
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

    // Deleting a folder alters the items that were in it, so the whole vault is resynced rather
    // than just the collection list.
    await this.syncService.fullSync(true);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("sharedFolderDeleted"),
    });
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

/**
 * The member's permission over `collection`, collapsing the `manage` / `readOnly` /
 * `hidePasswords` flags onto one {@link SharedFolderPermission} — mirroring the access selector's
 * `convertToPermission`, plus the implicit Manage an organization's admins and owners hold over
 * every folder.
 */
function resolvePermission(
  collection: CollectionView,
  organization: Organization | undefined,
): SharedFolderPermission {
  if (organization?.canEditAllCiphers || collection.manage) {
    return SharedFolderPermission.Manage;
  }

  if (collection.readOnly) {
    return collection.hidePasswords
      ? SharedFolderPermission.ViewExceptPass
      : SharedFolderPermission.View;
  }

  return collection.hidePasswords
    ? SharedFolderPermission.EditExceptPass
    : SharedFolderPermission.Edit;
}

/**
 * How many items the folder holds, counted through {@link cipherInScope} rather than by matching
 * `collectionIds` directly — so the count excludes trashed and archived items on the same terms
 * the vault page's own folder drill-in does, and the two can't drift.
 */
function countItems(
  ciphers: CipherViewLike[],
  organizationId: OrganizationId,
  collection: CollectionView,
): number {
  const scope: VaultScope = {
    type: VaultScopeType.Organization,
    organizationId,
    collectionId: collection.id,
  };

  return ciphers.filter((cipher) => cipherInScope(cipher, scope)).length;
}
