import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ButtonModule, DialogService } from "@bitwarden/components";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";
import {
  AddItemDialogComponent,
  AddItemDialogResult,
  CipherRowMenuHandlers,
  CipherRowMenuService,
  DEFAULT_COPY_PRESENTATION,
  DefaultCipherFormConfigService,
  NewCipherMenuComponent,
  VaultCopyButtonsService,
  VaultItemsTableComponent,
  VaultItemsTableCopyPresentation,
  VaultItemsTableRowAction,
  VaultOrganizationUserNotificationsComponent,
} from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";
import { ImportDialogComponent } from "../../tools/import/import-dialog.component";
import { WebVaultItemActionsService } from "../services/vault-item-actions.service";

import { VaultBannersComponent } from "./vault-banners/vault-banners.component";
import { VaultOnboardingComponent } from "./vault-onboarding/vault-onboarding.component";

/**
 * The web individual vault built on the shared {@link VaultItemsTableComponent}, which owns its own
 * search, filter chips, and sorting — so this page has no filter sidebar.
 *
 * Not yet wired: the typed filter adapter that syncs the
 * table's chips to the URL, the redirect that rewrites legacy filter query params, and the
 * `?itemId=&action=` deep link that opens an item on load. Until the chips are wired there is no
 * route to trash or the archive from this page, so both are excluded from the list — which also
 * means the archive's "premium subscription ended" callout has nowhere to surface yet.
 */
@Component({
  selector: "app-vault-next",
  templateUrl: "./vault-next.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0",
  },
  imports: [
    ButtonModule,
    I18nPipe,
    HeaderModule,
    NewCipherMenuComponent,
    VaultBannersComponent,
    VaultItemsTableComponent,
    VaultOnboardingComponent,
    VaultOrganizationUserNotificationsComponent,
  ],
  providers: [
    safeProvider({ provide: DefaultCipherFormConfigService, useAngularDecorators: true }),
    safeProvider({ provide: WebVaultItemActionsService, useAngularDecorators: true }),
  ],
})
export class VaultNextComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherRowMenuService = inject(CipherRowMenuService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly copyButtonsService = inject(VaultCopyButtonsService);
  private readonly dialogService = inject(DialogService);
  private readonly folderService = inject(FolderService);
  private readonly itemActions = inject(WebVaultItemActionsService);
  private readonly organizationService = inject(OrganizationService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly ciphers$ = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        // Emits null until the first decrypt completes.
        this.cipherService.cipherListViews$(userId).pipe(filterOutNullish()),
        this.restrictedItemTypesService.restricted$,
      ]),
    ),
    map(([ciphers, restricted]) =>
      ciphers.filter(
        (cipher) =>
          !CipherViewLikeUtils.isDeleted(cipher) &&
          !CipherViewLikeUtils.isArchived(cipher) &&
          !this.restrictedItemTypesService.isCipherRestricted(cipher, restricted),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** `undefined` until the ciphers stream first emits, which is what drives {@link loading}. */
  private readonly loadedCiphers = toSignal(this.ciphers$);

  protected readonly ciphers = computed<CipherViewLike[]>(() => this.loadedCiphers() ?? []);
  protected readonly loading = computed(() => this.loadedCiphers() === undefined);

  protected readonly folders = toSignal(
    this.userId$.pipe(
      switchMap((userId) => this.folderService.folderViews$(userId)),
      // `folderViews$` appends a "no folder" pseudo-folder with an empty id. The table has its own
      // NO_FOLDER sentinel for that option, so passing it through would duplicate it and defeat the
      // table's own "user has no folders" check.
      map((folders) => folders.filter((folder) => folder.id != null && folder.id !== "")),
    ),
    { initialValue: [] },
  );

  protected readonly collections = toSignal(
    this.userId$.pipe(switchMap((userId) => this.collectionService.decryptedCollections$(userId))),
    { initialValue: [] },
  );

  protected readonly organizations = toSignal(
    this.userId$.pipe(switchMap((userId) => this.organizationService.organizations$(userId))),
    { initialValue: [] },
  );

  protected readonly copyPresentation = toSignal(
    this.copyButtonsService.showQuickCopyActions$.pipe(
      map((showQuickCopyActions): VaultItemsTableCopyPresentation =>
        showQuickCopyActions ? "expanded" : "collapsed",
      ),
    ),
    { initialValue: DEFAULT_COPY_PRESENTATION },
  );

  private readonly rowMenuHandlers = computed<CipherRowMenuHandlers<CipherViewLike>>(() => ({
    edit: (item) => this.itemActions.edit(item),
    clone: (item) => this.itemActions.clone(item),
    assignToCollections: (item) => this.itemActions.assignToCollections(item, this.collections()),
  }));

  protected readonly rowActions = computed<VaultItemsTableRowAction<CipherViewLike>[]>(() =>
    this.cipherRowMenuService.getRowActions<CipherViewLike>(
      this.collections(),
      this.rowMenuHandlers(),
    ),
  );

  /**
   * Clicking an item's name opens the read-only view, matching the legacy vault — the dialog offers
   * its own Edit toggle from there, while the `edit` row action goes straight to the form.
   *
   * Bound as an input, so it must be a stable reference rather than a method: a new function on each
   * change detection pass would churn the table's name column.
   */
  protected readonly itemAction = (item: CipherViewLike): Promise<void> =>
    this.itemActions.view(item);

  /** Handles `vault-new-cipher-menu`'s `cipherAdded`, emitted by its legacy per-type dropdown. */
  protected async addCipher(cipherType: CipherType): Promise<void> {
    await this.itemActions.add(cipherType);
  }

  /**
   * Handles `vault-new-cipher-menu`'s `onAddItemDialog`, which it only emits once
   * `PM32009NewItemTypes` is on.
   */
  protected async openAddItemDialog(): Promise<void> {
    const dialogRef = AddItemDialogComponent.open(this.dialogService, {
      canCreateCipher: true,
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: true,
    });
    const result = await firstValueFrom(dialogRef.closed);
    if (result?.result !== AddItemDialogResult.Cipher) {
      return;
    }

    await this.itemActions.add(result.cipherType);
  }

  protected openImportDialog(): void {
    ImportDialogComponent.open(this.dialogService);
  }
}
