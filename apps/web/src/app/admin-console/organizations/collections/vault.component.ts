// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
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

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { NoResults } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAdminView,
  CollectionView,
  Unassigned,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  getFlatCollectionTree,
  getNestedCollectionTree,
} from "@bitwarden/common/admin-console/utils";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { BannerModule, DialogService, NoItemsModule, ToastService } from "@bitwarden/components";
import {
  AddItemDialogCloseResult,
  AddItemDialogComponent,
  AddItemDialogResult,
  CipherFormConfigService,
  DecryptionFailureDialogComponent,
  VaultFilterServiceAbstraction as VaultFilterService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  createFilterFunction,
  All,
  RoutedVaultFilterModel,
  VaultFilter,
} from "@bitwarden/vault";
import {
  OrganizationFreeTrialWarningComponent,
  OrganizationResellerRenewalWarningComponent,
} from "@bitwarden/web-vault/app/billing/organizations/warnings/components";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import { VaultItemsComponent } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-items.component";

import { SharedModule } from "../../../shared";
import { VaultItemEvent } from "../../../vault/components/vault-items/vault-item-event";
import { VaultItemsModule } from "../../../vault/components/vault-items/vault-items.module";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { GroupApiService, GroupView } from "../core";
import { CollectionDialogTabType } from "../shared/components/collection-dialog";

import { CollectionAccessRestrictedComponent } from "./collection-access-restricted.component";
import { VaultCipherActionsService } from "./services/vault-cipher-actions.service";
import { VaultCollectionActionsService } from "./services/vault-collection-actions.service";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultHeaderComponent } from "./vault-header/vault-header.component";

const BroadcasterSubscriptionId = "OrgVaultComponent";
const SearchTextDebounceInterval = 200;

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum AddAccessStatusType {
  All = 0,
  AddAccess = 1,
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-vault",
  templateUrl: "vault.component.html",
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
  ],
  providers: [
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
    { provide: CipherFormConfigService, useClass: AdminConsoleCipherFormConfigService },
    VaultCipherActionsService,
    VaultCollectionActionsService,
  ],
})
export class VaultComponent implements OnInit, OnDestroy {
  protected Unassigned = Unassigned;

  trashCleanupWarning: string = this.i18nService.t(
    this.platformUtilsService.isSelfHost()
      ? "trashCleanupWarningSelfHosted"
      : "trashCleanupWarning",
  );

  activeFilter: VaultFilter = new VaultFilter();

  protected showAddAccessToggle = false;
  protected noItemIcon = NoResults;
  protected loading$: Observable<boolean>;
  protected processingEvent$ = new BehaviorSubject<boolean>(false);
  protected organization$: Observable<Organization>;
  protected allGroups$: Observable<GroupView[]>;
  protected ciphers$: Observable<CipherView[]>;
  protected allCiphers$: Observable<CipherView[]>;
  protected showCollectionAccessRestricted$: Observable<boolean>;

  protected isEmpty$: Observable<boolean> = of(false);
  protected prevCipherId: string | null = null;
  protected userId$: Observable<UserId>;

  protected hideVaultFilter$: Observable<boolean>;
  protected currentSearchText$: Observable<string>;
  protected filter$: Observable<RoutedVaultFilterModel>;
  private organizationId$: Observable<OrganizationId>;

  private searchText$ = new Subject<string>();
  protected refreshingSubject$ = new BehaviorSubject<boolean>(true);
  private destroy$ = new Subject<void>();
  protected addAccessStatus$ = new BehaviorSubject<AddAccessStatusType>(0);

  /**
   * A list of collections that the user can assign items to and edit those items within.
   * @protected
   */
  protected editableCollections$: Observable<CollectionAdminView[]>;
  protected allCollectionsWithoutUnassigned$: Observable<CollectionAdminView[]>;
  protected allCollections$: Observable<CollectionAdminView[]>;
  protected collections$: Observable<CollectionAdminView[]>;
  protected selectedCollection$: Observable<TreeNode<CollectionAdminView> | undefined>;
  private nestedCollections$: Observable<TreeNode<CollectionAdminView>[]>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("vaultItems", { static: false }) vaultItemsComponent:
    | VaultItemsComponent<CipherView>
    | undefined;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    protected vaultFilterService: VaultFilterService,
    private routedVaultFilterBridgeService: RoutedVaultFilterBridgeService,
    private routedVaultFilterService: RoutedVaultFilterService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private syncService: SyncService,
    private i18nService: I18nService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private collectionAdminService: CollectionAdminService,
    private searchService: SearchService,
    private searchPipe: SearchPipe,
    private groupService: GroupApiService,
    private logService: LogService,
    private accountService: AccountService,
    protected billingApiService: BillingApiServiceAbstraction,
    private organizationWarningsService: OrganizationWarningsService,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private cipherActions: VaultCipherActionsService,
    private collectionActions: VaultCollectionActionsService,
  ) {
    this.userId$ = this.accountService.activeAccount$.pipe(getUserId);
    this.filter$ = this.routedVaultFilterService.filter$;
    this.organizationId$ =
      // FIXME: The RoutedVaultFilterModel uses `organizationId: Unassigned` to represent the individual vault,
      // but that is never used in Admin Console. This function narrows the type so it doesn't pollute our code here,
      // but really we should change to using our own vault filter model that only represents valid states in AC.
      this.filter$.pipe(
        map((filter) => filter.organizationId),
        filter((filter) => filter !== undefined),
        filter(
          (value: OrganizationId | Unassigned): value is OrganizationId => value !== Unassigned,
        ),
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

    this.allCollectionsWithoutUnassigned$ = this.refreshingSubject$.pipe(
      filter((refreshing) => refreshing),
      switchMap(() => combineLatest([this.organizationId$, this.userId$])),
      switchMap(([orgId, userId]) =>
        this.collectionAdminService.collectionAdminViews$(orgId, userId),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.allCollections$ = combineLatest([
      this.organizationId$,
      this.allCollectionsWithoutUnassigned$,
    ]).pipe(
      map(([organizationId, allCollections]) => {
        // FIXME: We should not assert that the Unassigned type is a CollectionId.
        // Instead we should consider representing the Unassigned collection as a different object, given that
        // it is not actually a collection.
        const noneCollection = new CollectionAdminView({
          name: this.i18nService.t("unassigned"),
          id: Unassigned as CollectionId,
          organizationId: organizationId,
        });
        return allCollections.concat(noneCollection);
      }),
    );

    this.nestedCollections$ = this.allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.allGroups$ = this.organizationId$.pipe(
      switchMap((organizationId) => this.groupService.getAll(organizationId)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.allCiphers$ = combineLatest([
      this.organization$,
      this.userId$,
      this.restrictedItemTypesService.restricted$,
      this.refreshingSubject$,
    ]).pipe(
      filter(([, , , refreshing]) => refreshing),
      switchMap(async ([organization, userId, restricted]) => {
        // If user swaps organization reset the addAccessToggle
        if (!this.showAddAccessToggle || organization) {
          this.addAccessToggle(0);
        }
        let ciphers;

        // Restricted providers (who are not members) do not have access org cipher endpoint below
        // Return early to avoid 404 response
        if (!organization.isMember && organization.isProviderUser) {
          return [];
        }

        // If the user can edit all ciphers for the organization then fetch them ALL.
        if (organization.canEditAllCiphers) {
          ciphers = await this.cipherService.getAllFromApiForOrganization(organization.id);
          ciphers.forEach((c) => (c.edit = true));
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
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.selectedCollection$ = combineLatest([this.nestedCollections$, this.filter$]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      map(([collections, filter]) => {
        if (
          filter.collectionId === undefined ||
          filter.collectionId === All ||
          filter.collectionId === Unassigned
        ) {
          return;
        }

        return ServiceUtils.getTreeNodeObjectFromList(collections, filter.collectionId);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.showCollectionAccessRestricted$ = combineLatest([
      this.filter$,
      this.selectedCollection$,
      this.organization$,
    ]).pipe(
      map(([filter, collection, organization]) => {
        return (
          (filter.collectionId === Unassigned && !organization.canEditUnassignedCiphers) ||
          (!organization.canEditAllCiphers && collection != undefined && !collection.node.assigned)
        );
      }),
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
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(
        async ([
          ciphers,
          filter,
          searchText,
          showCollectionAccessRestricted,
          userId,
          organizationId,
        ]) => {
          if (filter.collectionId === undefined && filter.type === undefined) {
            return [];
          }

          if (showCollectionAccessRestricted) {
            // Do not show ciphers for restricted collections
            // Ciphers belonging to multiple collections may still be present in $allCiphers and shouldn't be visible
            return [];
          }

          const filterFunction = createFilterFunction(filter);

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

    this.editableCollections$ = combineLatest([
      this.allCollectionsWithoutUnassigned$,
      this.organization$,
    ]).pipe(
      map(([collections, organization]) => {
        // Users that can edit all ciphers can implicitly add to / edit within any collection
        if (organization.canEditAllCiphers) {
          return collections;
        }
        return collections.filter((c) => c.assigned);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.collections$ = combineLatest([
      this.nestedCollections$,
      this.filter$,
      this.currentSearchText$,
      this.addAccessStatus$,
      this.userId$,
      this.organization$,
    ]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      concatMap(
        async ([collections, filter, searchText, addAccessStatus, userId, organization]) => {
          if (
            filter.collectionId === Unassigned ||
            (filter.collectionId === undefined && filter.type !== undefined)
          ) {
            return [];
          }

          this.showAddAccessToggle = false;
          let searchableCollectionNodes: TreeNode<CollectionAdminView>[] = [];
          if (filter.collectionId === undefined || filter.collectionId === All) {
            searchableCollectionNodes = collections;
          } else {
            const selectedCollection = ServiceUtils.getTreeNodeObjectFromList(
              collections,
              filter.collectionId,
            );
            searchableCollectionNodes = selectedCollection?.children ?? [];
          }

          let collectionsToReturn: CollectionAdminView[] = [];

          if (await this.searchService.isSearchable(searchText)) {
            // Flatten the tree for searching through all levels
            const flatCollectionTree: CollectionAdminView[] =
              getFlatCollectionTree(searchableCollectionNodes);

            collectionsToReturn = this.searchPipe.transform(
              flatCollectionTree,
              searchText,
              (collection) => collection.name,
              (collection) => collection.id,
            );
          } else {
            collectionsToReturn = searchableCollectionNodes.map(
              (treeNode: TreeNode<CollectionAdminView>): CollectionAdminView => treeNode.node,
            );
          }

          // Add access toggle is only shown if allowAdminAccessToAllCollectionItems is false and there are unmanaged collections the user can edit
          this.showAddAccessToggle =
            !organization.allowAdminAccessToAllCollectionItems &&
            organization.canEditUnmanagedCollections &&
            collectionsToReturn.some((c) => c.unmanaged);

          if (addAccessStatus === 1 && this.showAddAccessToggle) {
            collectionsToReturn = collectionsToReturn.filter((c) => c.unmanaged);
          }
          return collectionsToReturn;
        },
      ),
      takeUntil(this.destroy$),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

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
      this.refreshingSubject$,
      this.processingEvent$,
      firstLoadComplete$,
    ]).pipe(
      map(
        ([refreshing, processing, firstLoadComplete]) =>
          refreshing || processing || !firstLoadComplete,
      ),
    );
  }

  async ngOnInit() {
    this.cipherActions.init(
      this.organization$,
      this.userId$,
      this.filter$,
      this.editableCollections$,
      this.selectedCollection$,
      this.routedVaultFilterBridgeService.activeFilter$,
      () => this.refresh(),
      (queryParams, opts) => this.go(queryParams, opts),
    );

    this.collectionActions.init(
      this.organization$,
      this.userId$,
      this.selectedCollection$,
      this.editableCollections$,
      () => this.refresh(),
    );

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

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              this.refresh();
              this.changeDetectorRef.detectChanges();
            }
            break;
        }
      });
    });

    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeFilter) => {
        this.activeFilter = activeFilter;

        // watch the active filters. Only show toggle when viewing the collections filter
        if (!this.activeFilter.collectionId) {
          this.showAddAccessToggle = false;
        }
      });

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
            this.prevCipherId = null;
            return;
          }

          if (cipherId === this.prevCipherId) {
            return;
          }

          this.prevCipherId = cipherId;

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

        this.refreshingSubject$.next(false);
      });

    this.isEmpty$ = combineLatest([this.ciphers$, this.collections$]).pipe(
      map(([ciphers, collections]) => collections.length === 0 && ciphers?.length === 0),
    );
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
    this.addAccessStatus$.next(e);
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
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
      canCreateFolder: false,
      canCreateCollection: organization?.canCreateNewCollections ?? false,
      canCreateSshKey: true,
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
    this.refreshingSubject$.next(true);
    if (this.vaultItemsComponent) {
      this.vaultItemsComponent.clearSelection();
    }
  }

  private go(queryParams: any = null, navigateOptions?: NavigationExtras) {
    if (queryParams == null) {
      queryParams = {
        type: this.activeFilter.cipherType,
        collectionId: this.activeFilter.collectionId,
        deleted: this.activeFilter.isDeleted || null,
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
