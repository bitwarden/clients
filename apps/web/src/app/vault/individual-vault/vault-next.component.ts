import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, firstValueFrom, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  CollectionData,
  CollectionDetailsResponse,
} from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ButtonModule, DialogService, IconTileComponent } from "@bitwarden/components";
import { isGuid } from "@bitwarden/guid";
import { PolicyType } from "@bitwarden/sdk-internal";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";
import {
  AddEditFolderDialogComponent,
  AddItemDialogComponent,
  AddItemDialogResult,
  CipherRowMenuHandlers,
  CipherRowMenuService,
  DEFAULT_COPY_PRESENTATION,
  DefaultCipherFormConfigService,
  NewCipherMenuComponent,
  SharedFolderCardGridComponent,
  VaultCopyButtonsService,
  VaultBreadcrumbsComponent,
  VaultItemsTableComponent,
  VaultItemsTableCopyPresentation,
  VaultItemsTableRowAction,
  VaultNavService,
  VaultOrganizationUserNotificationsComponent,
  ALL_ITEMS_SCOPE,
  cipherInScope,
  collectionInScope,
  hasMultipleVaults,
  organizationNameForScope,
  organizationInScope,
  organizationVaultPage,
  OrganizationVaultPage,
  resolveVaultScope,
  scopedCollectionSegment,
  vaultScopeHeaderTile,
  vaultScopeTitle,
  scopedSharedFolderId,
  sharedFolderNameForScope,
  VaultScopeType,
  defaultUserCollectionId,
} from "@bitwarden/vault";

import {
  CollectionDialogAction,
  openCollectionDialog,
} from "../../admin-console/organizations/shared/components/collection-dialog";
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
    VaultBreadcrumbsComponent,
    IconTileComponent,
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
  private readonly policyService = inject(PolicyService);
  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly routeParams = toSignal(this.activatedRoute.paramMap);

  private readonly routeData = toSignal(this.activatedRoute.data);

  private readonly vaultIdParam = computed(() => this.routeParams()?.get("vaultId"));

  private readonly collectionSegment = computed(() =>
    scopedCollectionSegment(this.routeParams(), this.routeData()),
  );

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
      resolveVaultScope(this.vaultIdParam(), this.collectionSegment(), this.vaultNav()) ??
      ALL_ITEMS_SCOPE,
  );

  protected readonly defaultCollectionId = computed(() => {
    const scope = this.vaultScope();
    if (scope.type !== VaultScopeType.Organization) {
      return undefined;
    }
    return defaultUserCollectionId(scope.organizationId, this.vaultNav());
  });

  /** Only a shared folder trails a breadcrumb; every other page reads as a plain title. */
  protected readonly showBreadcrumbs = computed(
    () =>
      organizationVaultPage(this.vaultScope(), this.vaultNav()) ===
      OrganizationVaultPage.SharedFolder,
  );

  protected readonly headerTile = computed(() =>
    vaultScopeHeaderTile(this.vaultScope(), this.vaultNav()),
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
   * to offer them. The breadcrumb tree needs the whole vault for the same reason: the folder it
   * drills into has to be findable in the tree.
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
   * The shared folder the scope has drilled into, prefilled onto a new item — `undefined` unless
   * it names an actual collection rather than the {@link MY_ITEMS_ROUTE} sentinel, which
   * `resolveVaultScope` has yet to resolve to an id while the nav is still loading.
   */
  protected readonly scopedCollectionId = computed(() => {
    const collectionId = scopedSharedFolderId(this.vaultScope());
    return collectionId != null && isGuid(collectionId)
      ? (collectionId as CollectionId)
      : undefined;
  });

  /**
   * The vault-scope display-name facts {@link EmptyVaultComponent} needs for its copy, relayed
   * through `vault-items-table` untouched — the table itself has no notion of vault scope.
   *
   * Gated by {@link showItemCreation}: Trash and Archive are not vaults an "Add item" message
   * makes sense for, even for an account these facts would otherwise resolve non-empty for.
   */
  protected readonly emptyVaultOrganizationName = computed(() =>
    this.showItemCreation()
      ? organizationNameForScope(this.vaultScope(), this.vaultNav())
      : undefined,
  );

  protected readonly hasMultipleVaults = computed(
    () => this.showItemCreation() && hasMultipleVaults(this.vaultNav()),
  );

  protected readonly emptySharedFolderName = computed(() =>
    this.showItemCreation()
      ? sharedFolderNameForScope(this.vaultScope(), this.scopedCollections())
      : undefined,
  );

  protected readonly canCreateCollections = computed(() => {
    const scope = this.vaultScope();

    // The "Add item" menu offers a "New collection" action only for organization vaults or when viewing all their items
    if (scope.type !== VaultScopeType.Organization && scope.type !== VaultScopeType.AllItems) {
      return false;
    }

    return this.organizations()?.some((o) => o.canCreateNewCollections && !o.isProviderUser);
  });

  /**
   * Whether the page offers the toolbar's Import and New item actions. New items cannot be created
   * with a trashed or archived status and would "disappear" after creation on those views.
   */
  protected readonly showItemCreation = computed(() => {
    const { type } = this.vaultScope();
    return type !== VaultScopeType.Trash && type !== VaultScopeType.Archive;
  });

  protected readonly title = computed(() =>
    vaultScopeTitle(this.vaultScope(), this.i18nService, this.vaultNav()),
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

  /** Whether the `OrganizationDataOwnership` policy applies to the active user. */
  protected readonly orgRequiresDataOwnership = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
      ),
    ),
    { initialValue: false },
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
    await this.itemActions.add(cipherType, {
      organizationId: this.scopedOrganizationId(),
      collectionId: this.scopedCollectionId(),
    });
  }

  /**
   * Handles `vault-new-cipher-menu`'s `onAddItemDialog`, which it only emits once
   * `PM32009NewItemTypes` is on.
   */
  protected async openAddItemDialog(eventOrigin: "empty" | "toolbar"): Promise<void> {
    let toolbarOptions = {};
    // The empty state should only give the user options that allow them to populate that
    // empty state. Therefore folders and shared folders should only be included when the dialog
    // is opened from the toolbar.
    if (eventOrigin === "toolbar") {
      toolbarOptions = {
        canCreateFolder: true,
        canCreateCollection: this.canCreateCollections(),
      };
    }

    const dialogRef = AddItemDialogComponent.open(this.dialogService, {
      canCreateCipher: true,
      canCreateSshKey: true,
      canCreateFolder: false,
      canCreateCollection: false,
      ...toolbarOptions,
    });
    const result = await firstValueFrom(dialogRef.closed);
    if (result == null) {
      return;
    }

    if (result.result === AddItemDialogResult.Cipher) {
      await this.itemActions.add(result.cipherType, {
        organizationId: this.scopedOrganizationId(),
        collectionId: this.scopedCollectionId(),
      });
    } else if (result.result === AddItemDialogResult.Folder) {
      this.addFolder();
    } else if (result.result === AddItemDialogResult.Collection) {
      await this.addCollection();
    }
  }

  /** Handles `vault-new-cipher-menu`'s `folderAdded`, emitted by its legacy dropdown. */
  protected addFolder(): void {
    AddEditFolderDialogComponent.open(this.dialogService);
  }

  /** Handles `vault-new-cipher-menu`'s `collectionAdded`, emitted by its legacy dropdown. */
  protected async addCollection(): Promise<void> {
    const eligibleOrganizations = this.organizations()
      .filter((o) => o.canCreateNewCollections && !o.isProviderUser)
      .sort(Utils.getSortFunction(this.i18nService, "name"));
    if (eligibleOrganizations.length === 0) {
      return;
    }

    const defaultOrganizationId =
      eligibleOrganizations.find((o) => o.id === this.scopedOrganizationId())?.id ??
      eligibleOrganizations[0].id;

    const dialogRef = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: defaultOrganizationId,
        parentCollectionId: this.scopedCollectionId(),
        showOrgSelector: true,
        limitNestedCollections: true,
      },
    });
    const result = await firstValueFrom(dialogRef.closed);
    if (result?.action !== CollectionDialogAction.Saved) {
      return;
    }

    if (result.collection) {
      const userId = await firstValueFrom(this.userId$);
      await this.collectionService.upsert(
        new CollectionData(result.collection as CollectionDetailsResponse),
        userId,
      );
    }
  }

  protected openImportDialog(): void {
    ImportDialogComponent.open(this.dialogService);
  }
}
