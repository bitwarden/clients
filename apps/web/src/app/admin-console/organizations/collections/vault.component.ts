import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationExtras, Params, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  merge,
  Observable,
  of,
  Subject,
  zip,
} from "rxjs";
import {
  catchError,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  filter,
  first,
  map,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
} from "rxjs/operators";

import { NoResults } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAdminView,
  CollectionView,
  Unassigned,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  BannerModule,
  DialogService,
  NoItemsModule,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";
import {
  AddItemDialogCloseResult,
  AddItemDialogComponent,
  AddItemDialogResult,
  ASSIGN_COLLECTIONS_DIALOG,
  BULK_DELETE_DIALOG,
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  CipherFormConfigService,
  DecryptionFailureDialogComponent,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  VaultBatchActionComponent,
  VaultBatchBarService,
  VaultFilterServiceAbstraction as VaultFilterService,
  VaultFilter,
  createFilterFunction,
} from "@bitwarden/vault";
import {
  OrganizationFreeTrialWarningComponent,
  OrganizationResellerRenewalWarningComponent,
} from "@bitwarden/web-vault/app/billing/organizations/warnings/components";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import { VaultItemsComponent } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-items.component";

import { SharedModule } from "../../../shared";
import { AssignCollectionsWebDialogAdapter } from "../../../vault/components/assign-collections/assign-collections-web-dialog.adapter";
import { VaultItemEvent } from "../../../vault/components/vault-items/vault-item-event";
import { VaultItemsModule } from "../../../vault/components/vault-items/vault-items.module";
import { BulkDeleteDialogWebAdapter } from "../../../vault/individual-vault/bulk-action-dialogs/bulk-delete-dialog-web.adapter";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { GroupApiService, GroupView } from "../core";
import { CollectionDialogTabType } from "../shared/components/collection-dialog";

import { BulkEditCollectionAccessWebDialogAdapter } from "./bulk-collections-dialog/bulk-edit-collection-access-web-dialog.adapter";
import { CollectionAccessRestrictedComponent } from "./collection-access-restricted.component";
import { ACRoutedVaultFilterModel, toACFilter } from "./models/ac-routed-vault-filter.model";
import { DefaultVaultCollectionService } from "./services/default-vault-collection.service";
import { VaultCipherActionsService } from "./services/vault-cipher-actions.service";
import { VaultCollectionActionsService } from "./services/vault-collection-actions.service";
import { AddAccessStatusType, VaultCollectionService } from "./services/vault-collection.service";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultHeaderComponent } from "./vault-header/vault-header.component";

const SearchTextDebounceInterval = 200;

@Component({
  selector: "app-org-vault",
  templateUrl: "vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VaultHeaderComponent,
    CollectionAccessRestrictedComponent,
    VaultFilterModule,
    VaultItemsModule,
    SharedModule,
    BannerModule,
    NoItemsModule,
    OrganizationFreeTrialWarningComponent,
    OrganizationResellerRenewalWarningComponent,
    VaultBatchActionComponent,
    TooltipDirective,
  ],
  providers: [
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
    { provide: CipherFormConfigService, useClass: AdminConsoleCipherFormConfigService },
    VaultCollectionActionsService,
    { provide: VaultCollectionService, useClass: DefaultVaultCollectionService },
    VaultCipherActionsService,
    VaultBatchBarService,
    safeProvider({
      provide: ASSIGN_COLLECTIONS_DIALOG,
      useClass: AssignCollectionsWebDialogAdapter,
      useAngularDecorators: true,
    }),
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
export class VaultComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  protected readonly vaultFilterService = inject(VaultFilterService);
  private readonly routedVaultFilterService = inject(RoutedVaultFilterService);
  private readonly router = inject(Router);
  private readonly syncService = inject(SyncService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly cipherService = inject(CipherService);
  private readonly searchService = inject(SearchService);
  private readonly groupService = inject(GroupApiService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  protected readonly billingApiService = inject(BillingApiServiceAbstraction);
  private readonly organizationWarningsService = inject(OrganizationWarningsService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly collectionActions = inject(VaultCollectionActionsService);
  protected readonly collectionService = inject(VaultCollectionService);
  private readonly cipherActions = inject(VaultCipherActionsService);
  private readonly vaultBatchBarService = inject(VaultBatchBarService);
  private readonly configService = inject(ConfigService);

  protected readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
    { initialValue: false },
  );

  protected readonly vaultBatchBarFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM37785_VaultBatchBar),
    { initialValue: false },
  );

  protected readonly Unassigned = Unassigned;

  readonly trashCleanupWarning: string = this.i18nService.t(
    this.platformUtilsService.isSelfHost()
      ? "trashCleanupWarningSelfHosted"
      : "trashCleanupWarning",
  );

  readonly activeFilter: Signal<VaultFilter>;
  protected readonly showAddAccessToggle: Signal<boolean>;

  protected readonly noItemIcon = NoResults;
  protected readonly loading$: Observable<boolean>;
  protected readonly processingEvent$ = new BehaviorSubject<boolean>(false);
  protected readonly organization$: Observable<Organization>;
  protected readonly allGroups$: Observable<GroupView[]>;
  protected readonly ciphers$: Observable<CipherView[]>;
  protected readonly allCiphers$: Observable<CipherView[]>;

  protected readonly isEmpty$: Observable<boolean>;
  private readonly prevCipherId = signal<string | undefined>(undefined);
  protected readonly userId$: Observable<UserId> =
    this.accountService.activeAccount$.pipe(getUserId);

  protected readonly hideVaultFilter$: Observable<boolean>;
  protected readonly currentSearchText$: Observable<string>;
  protected readonly filter$: Observable<ACRoutedVaultFilterModel> =
    this.routedVaultFilterService.filter$.pipe(map(toACFilter), filter(Boolean));
  private readonly organizationId$: Observable<OrganizationId>;

  private readonly searchText$ = new Subject<string>();
  private readonly refresh$ = new Subject<void>();
  protected readonly isRefreshing$ = new BehaviorSubject<boolean>(true);
  private readonly destroy$ = new Subject<void>();

  protected readonly allCollections$: Observable<CollectionAdminView[]>;
  protected readonly collections$: Observable<CollectionAdminView[]>;
  protected readonly selectedCollection$: Observable<TreeNode<CollectionAdminView> | undefined>;
  protected readonly showCollectionAccessRestricted$: Observable<boolean>;

  protected readonly vaultItemsComponent = viewChild<VaultItemsComponent<CipherView>>("vaultItems");

  constructor() {
    this.organizationId$ = this.filter$.pipe(
      map((f) => f.organizationId),
      distinctUntilChanged(),
    );

    this.currentSearchText$ = this.route.queryParams.pipe(map((queryParams) => queryParams.search));

    this.organization$ = combineLatest([this.organizationId$, this.userId$]).pipe(
      switchMap(([orgId, userId]) =>
        this.organizationService.organizations$(userId).pipe(getById(orgId)),
      ),
      filter((organization) => organization != null),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.hideVaultFilter$ = this.organization$.pipe(
      map((organization) => organization.isProviderUser && !organization.isMember),
    );

    this.allCollections$ = this.collectionService.allCollections$;
    this.collections$ = this.collectionService.collections$;
    this.selectedCollection$ = this.collectionService.selectedCollection$;
    this.showCollectionAccessRestricted$ = this.collectionService.showCollectionAccessRestricted$;
    this.showAddAccessToggle = toSignal(this.collectionService.showAddAccessToggle$, {
      initialValue: false,
    });

    this.allGroups$ = this.organizationId$.pipe(
      switchMap((organizationId) => this.groupService.getAll(organizationId)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.allCiphers$ = this.refresh$.pipe(
      startWith(undefined),
      switchMap(() =>
        combineLatest([this.organization$, this.restrictedItemTypesService.restricted$]).pipe(
          switchMap(async ([organization, restricted]) => {
            // Reset the add-access filter whenever ciphers reload (e.g. on org switch or refresh)
            this.collectionService.setAddAccessStatus(AddAccessStatusType.All);
            let ciphers;

            // Restricted providers (who are not members) do not have access org cipher endpoint below
            // Return early to avoid 404 response
            if (!organization.isMember && organization.isProviderUser) {
              return [];
            }

            // If the user can edit all ciphers for the organization then fetch them ALL.
            if (organization.canEditAllCiphers) {
              ciphers = await this.cipherService.getAllFromApiForOrganization(organization.id);
              ciphers.forEach((c) => {
                c.edit = true;
                c.viewPassword = true;
              });
            } else {
              // Otherwise, only fetch ciphers they have access to (includes unassigned for admins).
              ciphers = await this.cipherService.getManyFromApiForOrganization(organization.id);
            }

            // Filter out restricted ciphers before indexing
            ciphers = ciphers.filter(
              (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, restricted),
            );

            return ciphers;
          }),
        ),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.ciphers$ = combineLatest([
      this.allCiphers$,
      this.filter$,
      this.currentSearchText$,
      this.showCollectionAccessRestricted$,
      this.userId$,
      this.organizationId$,
    ]).pipe(
      filter(([ciphers, f]) => ciphers != undefined && f != undefined),
      concatMap(
        async ([ciphers, f, searchText, showCollectionAccessRestricted, userId, organizationId]: [
          CipherView[],
          ACRoutedVaultFilterModel,
          string,
          boolean,
          UserId,
          OrganizationId,
        ]) => {
          if (f.collectionId === undefined && f.type === undefined) {
            return [];
          }

          if (showCollectionAccessRestricted) {
            // Do not show ciphers for restricted collections
            // Ciphers belonging to multiple collections may still be present in $allCiphers and shouldn't be visible
            return [];
          }

          const filterFunction = createFilterFunction(f);

          if (await this.searchService.isSearchable(searchText)) {
            const searchFilteredCiphers = await this.searchService.searchCiphers<CipherView>(
              userId,
              organizationId,
              searchText,
              ciphers,
            );
            return searchFilteredCiphers.filter(filterFunction);
          }

          return ciphers.filter(filterFunction);
        },
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // Billing Warnings
    this.organization$
      .pipe(
        switchMap((organization) =>
          merge(
            this.organizationWarningsService.showInactiveSubscriptionDialog$(organization),
            this.organizationWarningsService.showSubscribeBeforeFreeTrialEndsDialog$(organization),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
    // End Billing Warnings

    const firstLoadComplete$ = zip([
      this.organization$,
      this.filter$,
      this.allCollections$,
      this.allGroups$,
      this.ciphers$,
      this.collections$,
      this.selectedCollection$,
      this.showCollectionAccessRestricted$,
    ]).pipe(
      map(() => true),
      startWith(false),
      take(2), // Only take the emmision from startsWith and the emission from zip.
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.loading$ = combineLatest([
      this.isRefreshing$,
      this.processingEvent$,
      firstLoadComplete$,
    ]).pipe(
      map(
        ([refreshing, processing, firstLoadComplete]) =>
          refreshing || processing || !firstLoadComplete,
      ),
    );

    this.isEmpty$ = combineLatest([this.ciphers$, this.collections$]).pipe(
      map(([ciphers, collections]) => collections.length === 0 && ciphers?.length === 0),
    );

    this.activeFilter = toSignal(this.cipherActions.activeFilter$, {
      initialValue: new VaultFilter(),
    });
  }

  async ngOnInit() {
    const firstSetup$ = combineLatest([this.organization$, this.route.queryParams]).pipe(
      first(),
      switchMap(async ([organization]) => {
        if (!organization.canEditAnyCollection) {
          await this.syncService.fullSync(false);
        }
        return;
      }),
      catchError((error: unknown) => {
        this.logService.error("Failed during firstSetup$:", error);
        return of();
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.cipherActions.refresh$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refresh());
    this.collectionActions.refresh$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refresh());
    this.vaultBatchBarService.completed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refresh());
    combineLatest([this.organization$, this.allCollections$, this.ciphers$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([organization, allCollections, ciphers]) => {
        this.vaultBatchBarService.setConfig({
          isOrgVault: true,
          organization,
          allCollections,
          hasCiphers: ciphers.length > 0,
        });
      });

    this.cipherActions.navigate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ queryParams, options }) => this.go(queryParams, options));

    this.searchText$
      .pipe(debounceTime(SearchTextDebounceInterval), takeUntil(this.destroy$))
      .subscribe((searchText) =>
        this.router.navigate([], {
          queryParams: { search: Utils.isNullOrEmpty(searchText) ? null : searchText },
          queryParamsHandling: "merge",
          replaceUrl: true,
          state: {
            focusAfterNav: false,
          },
        }),
      );

    const allCipherMap$ = this.allCiphers$.pipe(
      map((ciphers) => {
        return Object.fromEntries(ciphers.map((c) => [c.id, c]));
      }),
    );

    // Handle deep linking to a specific cipher (if the route specifies a cipherId)
    firstSetup$
      .pipe(
        switchMap(() => combineLatest([this.route.queryParams, allCipherMap$])),
        filter(() => !this.cipherActions.hasOpenDialog),
        switchMap(async ([qParams, allCiphersMap]) => {
          const cipherId = getCipherIdFromParams(qParams);

          if (!cipherId) {
            this.prevCipherId.set(undefined);
            return;
          }

          if (cipherId === this.prevCipherId()) {
            return;
          }

          this.prevCipherId.set(cipherId);

          const cipher = allCiphersMap[cipherId];
          if (cipher) {
            let action = qParams.action;

            if (action == "showFailedToDecrypt") {
              DecryptionFailureDialogComponent.open(this.dialogService, {
                cipherIds: [cipherId as CipherId],
              });
              await this.router.navigate([], {
                queryParams: { itemId: null, cipherId: null, action: null },
                queryParamsHandling: "merge",
                replaceUrl: true,
              });
              return;
            }

            // Default to "view"
            if (action == null) {
              action = "view";
            }

            if (action === "view") {
              await this.cipherActions.viewCipherById(cipher);
            } else {
              await this.cipherActions.editCipher(cipher, false);
            }
          } else {
            this.toastService.showToast({
              variant: "error",
              message: this.i18nService.t("unknownCipher"),
            });
            await this.router.navigate([], {
              queryParams: { cipherId: null, itemId: null },
              queryParamsHandling: "merge",
            });
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Handle deep linking to a cipher event
    firstSetup$
      .pipe(
        switchMap(() =>
          combineLatest([this.route.queryParams, this.organization$, this.allCiphers$]),
        ),
        switchMap(async ([qParams, organization, allCiphers$]) => {
          const cipherId = qParams.viewEvents;
          if (!cipherId) {
            return;
          }
          const cipher = allCiphers$.find((c) => c.id === cipherId);
          if (organization.useEvents && cipher != undefined) {
            await this.cipherActions.viewEvents(cipher);
          } else {
            this.toastService.showToast({
              variant: "error",
              message: this.i18nService.t("unknownCipher"),
            });
            await this.router.navigate([], {
              queryParams: { viewEvents: null },
              queryParamsHandling: "merge",
            });
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Handle last of initial setup - workaround for some state issues where we need to manually
    // push the collections we've loaded back into the VaultFilterService.
    // FIXME: figure out how we can remove this.
    firstSetup$
      .pipe(
        switchMap(() => this.allCollections$),
        takeUntil(this.destroy$),
      )
      .subscribe((allCollections) => {
        // This is a temporary fix to avoid double fetching collections.
        // TODO: Remove when implementing new VVR menu
        if (this.vaultFilterService.reloadCollections) {
          this.vaultFilterService.reloadCollections(allCollections);
        }

        this.isRefreshing$.next(false);
      });
  }

  async navigateToPaymentMethod() {
    const organizationId = await firstValueFrom(this.organizationId$);
    await this.router.navigate(
      ["organizations", `${organizationId}`, "billing", "payment-details"],
      {
        state: { launchPaymentModalAutomatically: true },
      },
    );
  }

  addAccessToggle(e: AddAccessStatusType) {
    this.collectionService.setAddAccessStatus(e);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onVaultItemsEvent(event: VaultItemEvent<CipherView>) {
    this.processingEvent$.next(true);

    try {
      const organization = await firstValueFrom(this.organization$);
      switch (event.type) {
        case "viewAttachments":
          await this.cipherActions.editCipherAttachments(event.item);
          break;
        case "clone":
          await this.cipherActions.cloneCipher(event.item);
          break;
        case "restore":
          if (event.items.length === 1) {
            await this.cipherActions.restore(event.items[0]);
          } else {
            await this.cipherActions.bulkRestore(event.items);
          }
          break;
        case "delete": {
          const ciphers = event.items
            .filter((i) => i.collection === undefined)
            .map((i) => i.cipher)
            .filter((c) => c != null);
          const collections = event.items
            .filter((i) => i.cipher === undefined)
            .map((i) => i.collection)
            .filter((c) => c != null);
          if (ciphers.length === 1 && collections.length === 0) {
            await this.cipherActions.deleteCipher(ciphers[0]);
          } else if (ciphers.length === 0 && collections.length === 1) {
            await this.collectionActions.deleteCollection(collections[0] as CollectionAdminView);
          } else {
            await this.cipherActions.bulkDelete(
              ciphers,
              collections as CollectionView[],
              organization,
            );
          }
          break;
        }
        case "copyField":
          await this.cipherActions.copy(event.item, event.field);
          break;
        case "editCollection":
          await this.collectionActions.editCollection(
            event.item as CollectionAdminView,
            CollectionDialogTabType.Info,
            event.readonly,
          );
          break;
        case "viewCollectionAccess":
          await this.collectionActions.editCollection(
            event.item as CollectionAdminView,
            CollectionDialogTabType.Access,
            event.readonly,
            event.initialPermission,
          );
          break;
        case "bulkEditCollectionAccess":
          await this.collectionActions.bulkEditCollectionAccess(event.items, organization);
          break;
        case "assignToCollections":
          await this.cipherActions.bulkAssignToCollections(event.items);
          break;
        case "viewEvents":
          await this.cipherActions.viewEvents(event.item);
          break;
        case "editCipher":
          await this.cipherActions.editCipher(event.item);
          break;
      }
    } finally {
      this.processingEvent$.next(false);
    }
  }

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  /**
   * Opens the add-item type selection dialog and dispatches to the appropriate action service.
   */
  protected async openAddItemDialog(): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const ref = AddItemDialogComponent.open(this.dialogService, {
      canCreateCipher: organization?.enabled ?? true,
      canCreateFolder: false,
      canCreateCollection: organization?.canCreateNewCollections ?? false,
      canCreateSshKey: false,
    });
    const result: AddItemDialogCloseResult | undefined = await firstValueFrom(ref.closed);
    if (!result) {
      return;
    }
    if (result.result === AddItemDialogResult.Cipher) {
      await this.cipherActions.addCipher(result.cipherType);
    } else if (result.result === AddItemDialogResult.Collection) {
      await this.collectionActions.addCollection();
    }
  }

  /** Delegates to cipher actions service */
  async addCipher(cipherType?: CipherType): Promise<void> {
    await this.cipherActions.addCipher(cipherType);
  }

  /** Delegates to collection actions service */
  async addCollection(): Promise<void> {
    await this.collectionActions.addCollection();
  }

  /** Delegates to collection actions service */
  async editCollection(
    c: CollectionAdminView,
    tab: CollectionDialogTabType,
    readonly: boolean,
  ): Promise<void> {
    await this.collectionActions.editCollection(c, tab, readonly);
  }

  /** Delegates to collection actions service */
  async deleteCollection(collection: CollectionAdminView): Promise<void> {
    await this.collectionActions.deleteCollection(collection);
  }

  protected readonly CollectionDialogTabType = CollectionDialogTabType;

  private refresh() {
    this.isRefreshing$.next(true);
    this.refresh$.next();
    this.collectionService.reload();
    this.vaultItemsComponent()?.clearSelection();
  }

  private go(queryParams: any = null, navigateOptions?: NavigationExtras) {
    if (queryParams == null) {
      const activeFilter = this.activeFilter();
      queryParams = {
        type: activeFilter.cipherType,
        collectionId: activeFilter.collectionId,
        deleted: activeFilter.isDeleted || null,
      };
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: "merge",
      replaceUrl: true,
      ...navigateOptions,
    });
  }
}

/**
 * Allows backwards compatibility with
 * old links that used the original `cipherId` param
 */
const getCipherIdFromParams = (params: Params): string => {
  return params["itemId"] || params["cipherId"];
};
