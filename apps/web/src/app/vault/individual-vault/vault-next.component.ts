import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, firstValueFrom, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
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
  SharedFolderCardGridComponent,
  VaultCopyButtonsService,
  VaultItemsTableComponent,
  VaultItemsTableCopyPresentation,
  VaultItemsTableRowAction,
  VaultNavService,
  VaultOrganizationUserNotificationsComponent,
  ALL_ITEMS_SCOPE,
  cipherInScope,
  collectionInScope,
  organizationInScope,
  resolveVaultScope,
  VaultScopeType,
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
 * Every side-nav destination renders this one component, scoped by the `:vaultId` route segment —
 * see `VaultScope`.
 *
 * Not yet wired: the `?itemId=&action=` deep link that opens an item on load. The archive's
 * "premium subscription ended" callout has nowhere to surface yet.
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
    SharedFolderCardGridComponent,
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
  private readonly vaultNavService = inject(VaultNavService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly routeParams = toSignal(this.activatedRoute.paramMap);

  private readonly vaultIdParam = computed(() => this.routeParams()?.get("vaultId"));

  private readonly collectionIdParam = computed(() => this.routeParams()?.get("collectionId"));

  private readonly vaultNav = toSignal(
    this.userId$.pipe(switchMap((userId) => this.vaultNavService.viewModel$(userId))),
  );

  /**
   * The vault the side nav has scoped this page to, and the shared folder within it the URL has
   * drilled into. `vaultScopeGuard` has already turned away any segment that names no vault, so an
   * unresolvable one here means the guard was bypassed — show everything rather than an empty page.
   */
  protected readonly vaultScope = computed(
    () =>
      resolveVaultScope(this.vaultIdParam(), this.collectionIdParam(), this.vaultNav()) ??
      ALL_ITEMS_SCOPE,
  );

  /**
   * Every item the user can see, in every state. Which of trashed, archived, and active items a
   * page shows is the scope's call — see {@link cipherInScope} — so this narrows by nothing but
   * the restricted item types, which no scope may show.
   */
  private readonly allCiphers$ = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        // Emits null until the first decrypt completes.
        this.cipherService.cipherListViews$(userId).pipe(filterOutNullish()),
        this.restrictedItemTypesService.restricted$,
      ]),
    ),
    map(([ciphers, restricted]) =>
      ciphers.filter(
        (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, restricted),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** `undefined` until the ciphers stream first emits, which is what drives {@link loading}. */
  private readonly loadedCiphers = toSignal(this.allCiphers$);

  private readonly allCiphers = computed<CipherViewLike[]>(() => this.loadedCiphers() ?? []);

  /**
   * Every item in the account's active vaults. The banners and onboarding speak to the account as
   * a whole rather than to the page, so they read this instead of the scoped rows — an empty My
   * vault should not make an account that has organization items look brand new.
   */
  protected readonly activeCiphers = computed<CipherViewLike[]>(() =>
    this.allCiphers().filter((cipher) => cipherInScope(cipher, ALL_ITEMS_SCOPE)),
  );

  /** The rows for the table: {@link allCiphers} narrowed to the scope. */
  protected readonly ciphers = computed<CipherViewLike[]>(() => {
    const scope = this.vaultScope();
    return this.allCiphers().filter((cipher) => cipherInScope(cipher, scope));
  });

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

  /**
   * The collections the table resolves its Shared folders column and chip from, and the card grid
   * derives its tree from. The chip lists whatever this holds rather than deriving its options from
   * the rows, so a scoped page has to narrow it or it offers folders none of its items could be in.
   *
   * Narrowed to the vault only, never to the shared folder in view: an item belongs to as many
   * shared folders as it was assigned to, so a row in the folder being viewed may live in others
   * too — narrowing this would drop those from its Shared folders column and leave the chip unable
   * to offer them. The grid needs the whole vault for the same reason: the folder it drills into
   * has to be findable in the tree.
   *
   * The unscoped {@link collections} still back the row actions, which assign an item to any
   * collection the user can reach — not just the ones this page shows.
   */
  protected readonly scopedCollections = computed(() => {
    const scope = this.vaultScope();
    return this.collections().filter((collection) => collectionInScope(collection, scope));
  });

  /** The organizations the table names its Vault column and chip from — see {@link scopedCollections}. */
  protected readonly scopedOrganizations = computed(() => {
    const scope = this.vaultScope();
    return this.organizations().filter((organization) => organizationInScope(organization, scope));
  });

  /** Scopes the table's search index to the organization, for an organization vault. */
  protected readonly scopedOrganizationId = computed(() => {
    const scope = this.vaultScope();
    return scope.type === VaultScopeType.Organization ? scope.organizationId : undefined;
  });

  /**
   * Whether the page offers the toolbar's Import and New item actions. New items cannot be created
   * with a trashed or archived status and would "disappear" after creation on those views.
   */
  protected readonly showItemCreation = computed(() => {
    const { type } = this.vaultScope();
    return type !== VaultScopeType.Trash && type !== VaultScopeType.Archive;
  });

  /**
   * Placeholder header title for the scoped vault. Breadcrumbs replace this — see the page layout
   * epic — so it reuses the same strings the side nav labels these vaults with.
   *
   * `undefined` leaves the route's own `titleId` in place, which covers All items and the moment
   * before an organization's name has loaded.
   */
  protected readonly title = computed(() => {
    const scope = this.vaultScope();
    switch (scope.type) {
      case VaultScopeType.MyVault:
        return this.i18nService.t("myVault");
      case VaultScopeType.Organization:
        return this.scopedOrganizations()[0]?.name;
      case VaultScopeType.Trash:
        return this.i18nService.t("trash");
      case VaultScopeType.Archive:
        return this.i18nService.t("archiveNoun");
      default:
        return undefined;
    }
  });

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
