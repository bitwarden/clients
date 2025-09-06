import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  from,
  lastValueFrom,
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
  tap,
} from "rxjs/operators";

import {
  CollectionAdminService,
  CollectionAdminView,
  CollectionService,
  CollectionView,
  Unassigned,
} from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { NoResults } from "@bitwarden/assets/svg";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BannerModule,
  DialogRef,
  DialogService,
  NoItemsModule,
  ToastService,
} from "@bitwarden/components";
import {
  AttachmentDialogResult,
  AttachmentsV2Component,
  CipherFormConfig,
  CipherFormConfigService,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  PasswordRepromptService,
} from "@bitwarden/vault";
import {
  OrganizationFreeTrialWarningComponent,
  OrganizationResellerRenewalWarningComponent,
} from "@bitwarden/web-vault/app/billing/organizations/warnings/components";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import { VaultItemsComponent } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-items.component";

import { BillingNotificationService } from "../../../billing/services/billing-notification.service";
import {
  ResellerWarning,
  ResellerWarningService,
} from "../../../billing/services/reseller-warning.service";
import { TrialFlowService } from "../../../billing/services/trial-flow.service";
import { FreeTrial } from "../../../billing/types/free-trial";
import { SharedModule } from "../../../shared";
import { AssignCollectionsWebComponent } from "../../../vault/components/assign-collections";
import {
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "../../../vault/components/vault-item-dialog/vault-item-dialog.component";
import { VaultItemEvent } from "../../../vault/components/vault-items/vault-item-event";
import { VaultItemsModule } from "../../../vault/components/vault-items/vault-items.module";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "../../../vault/individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import { VaultFilterService } from "../../../vault/individual-vault/vault-filter/services/abstractions/vault-filter.service";
import { RoutedVaultFilterBridgeService } from "../../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
import { createFilterFunction } from "../../../vault/individual-vault/vault-filter/shared/models/filter-function";
import {
  All,
  RoutedVaultFilterModel,
} from "../../../vault/individual-vault/vault-filter/shared/models/routed-vault-filter.model";
import { VaultFilter } from "../../../vault/individual-vault/vault-filter/shared/models/vault-filter.model";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { GroupApiService, GroupView } from "../core";
import { openEntityEventsDialog } from "../manage/entity-events.component";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../shared/components/collection-dialog";

import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "./bulk-collections-dialog";
import { CollectionAccessRestrictedComponent } from "./collection-access-restricted.component";
import { getFlatCollectionTree, getNestedCollectionTree } from "./utils";
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
  ],
})
export class vNextVaultComponent implements OnInit, OnDestroy {
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
  private hasSubscription$ = new BehaviorSubject<boolean>(false);
  protected useOrganizationWarningsService$: Observable<boolean>;
  protected freeTrialWhenWarningsServiceDisabled$: Observable<FreeTrial>;
  protected resellerWarningWhenWarningsServiceDisabled$: Observable<ResellerWarning | null>;
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
  private vaultItemDialogRef?: DialogRef<VaultItemDialogResult> | undefined;

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

  @ViewChild("vaultItems", { static: false }) vaultItemsComponent:
    | VaultItemsComponent<CipherView>
    | undefined;

  private readonly unpaidSubscriptionDialog$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((id) =>
      this.organizationService.organizations$(id).pipe(
        filter((organizations) => organizations.length === 1),
        map(([organization]) => organization),
        switchMap((organization) =>
          from(this.billingApiService.getOrganizationBillingMetadata(organization.id)).pipe(
            tap((organizationMetaData) => {
              this.hasSubscription$.next(organizationMetaData.hasSubscription);
            }),
            switchMap((organizationMetaData) =>
              from(
                this.trialFlowService.handleUnpaidSubscriptionDialog(
                  organization,
                  organizationMetaData,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

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
    private dialogService: DialogService,
    private messagingService: MessagingService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService,
    private collectionAdminService: CollectionAdminService,
    private searchService: SearchService,
    private searchPipe: SearchPipe,
    private groupService: GroupApiService,
    private logService: LogService,
    private eventCollectionService: EventCollectionService,
    private totpService: TotpService,
    private apiService: ApiService,
    private toastService: ToastService,
    private configService: ConfigService,
    private cipherFormConfigService: CipherFormConfigService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private trialFlowService: TrialFlowService,
    protected billingApiService: BillingApiServiceAbstraction,
    private organizationBillingService: OrganizationBillingServiceAbstraction,
    private resellerWarningService: ResellerWarningService,
    private accountService: AccountService,
    private billingNotificationService: BillingNotificationService,
    private organizationWarningsService: OrganizationWarningsService,
    private collectionService: CollectionService,
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
      this.refreshingSubject$,
    ]).pipe(
      switchMap(async ([organization, userId]) => {
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

        await this.searchService.indexCiphers(userId, ciphers, organization.id);
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
    ]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, searchText, showCollectionAccessRestricted, userId]) => {
        if (filter.collectionId === undefined && filter.type === undefined) {
          return [];
        }

        if (showCollectionAccessRestricted) {
          // Do not show ciphers for restricted collections
          // Ciphers belonging to multiple collections may still be present in $allCiphers and shouldn't be visible
          return [];
        }

        const filterFunction = createFilterFunction(filter);

        if (await this.searchService.isSearchable(userId, searchText)) {
          return await this.searchService.searchCiphers<CipherView>(
            userId,
            searchText,
            [filterFunction],
            ciphers,
          );
        }

        return ciphers.filter(filterFunction);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // Billing Warnings
    this.useOrganizationWarningsService$ = this.configService.getFeatureFlag$(
      FeatureFlag.UseOrganizationWarningsService,
    );

    const freeTrial$ = combineLatest([
      this.organization$,
      this.hasSubscription$.pipe(filter((hasSubscription) => hasSubscription !== null)),
    ]).pipe(
      filter(
        ([org, hasSubscription]) => org.isOwner && hasSubscription && org.canViewBillingHistory,
      ),
      switchMap(([org]) =>
        combineLatest([
          of(org),
          this.organizationApiService.getSubscription(org.id),
          from(this.organizationBillingService.getPaymentSource(org.id)).pipe(
            map((paymentSource) => {
              if (paymentSource == null) {
                throw new Error("Payment source not found.");
              }
              return paymentSource;
            }),
          ),
        ]),
      ),
      map(([org, sub, paymentSource]) =>
        this.trialFlowService.checkForOrgsWithUpcomingPaymentIssues(org, sub, paymentSource),
      ),
      filter((result) => result !== null),
      catchError((error: unknown) => {
        this.billingNotificationService.handleError(error);
        return of();
      }),
    );

    this.freeTrialWhenWarningsServiceDisabled$ = this.useOrganizationWarningsService$.pipe(
      filter((enabled) => !enabled),
      switchMap(() => freeTrial$),
    );

    this.resellerWarningWhenWarningsServiceDisabled$ = combineLatest([
      this.organization$,
      this.useOrganizationWarningsService$,
    ]).pipe(
      filter(([org, enabled]) => !enabled && org.isOwner),
      switchMap(([org]) =>
        from(this.billingApiService.getOrganizationBillingMetadata(org.id)).pipe(
          map((metadata) => ({ org, metadata })),
        ),
      ),
      map(({ org, metadata }) => this.resellerWarningService.getWarning(org, metadata)),
    );

    this.organization$
      .pipe(
        switchMap((organization) =>
          this.organizationWarningsService.showSubscribeBeforeFreeTrialEndsDialog$(organization),
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
            searchableCollectionNodes = selectedCollection.children ?? [];
          }

          let collectionsToReturn: CollectionAdminView[] = [];

          if (await this.searchService.isSearchable(userId, searchText)) {
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
        filter(() => this.vaultItemDialogRef == undefined),
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
              await this.viewCipherById(cipher);
            } else {
              await this.editCipher(cipher, false);
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
            await this.viewEvents(cipher);
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

    combineLatest([this.useOrganizationWarningsService$, this.organization$])
      .pipe(
        switchMap(([enabled, organization]) =>
          enabled
            ? this.organizationWarningsService.showInactiveSubscriptionDialog$(organization)
            : this.unpaidSubscriptionDialog$,
        ),
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
    const managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
      FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
    );
    const route = managePaymentDetailsOutsideCheckout ? "payment-details" : "payment-method";
    const organizationId = await firstValueFrom(this.organizationId$);
    await this.router.navigate(["organizations", `${organizationId}`, "billing", route], {
      state: { launchPaymentModalAutomatically: true },
    });
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
          await this.editCipherAttachments(event.item);
          break;
        case "clone":
          await this.cloneCipher(event.item);
          break;
        case "restore":
          if (event.items.length === 1) {
            await this.restore(event.items[0]);
          } else {
            await this.bulkRestore(event.items);
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
            await this.deleteCipher(ciphers[0]);
          } else if (ciphers.length === 0 && collections.length === 1) {
            await this.deleteCollection(collections[0] as CollectionAdminView);
          } else {
            await this.bulkDelete(ciphers, collections, organization);
          }
          break;
        }
        case "copyField":
          await this.copy(event.item, event.field);
          break;
        case "editCollection":
          await this.editCollection(
            event.item as CollectionAdminView,
            CollectionDialogTabType.Info,
            event.readonly,
          );
          break;
        case "viewCollectionAccess":
          await this.editCollection(
            event.item as CollectionAdminView,
            CollectionDialogTabType.Access,
            event.readonly,
          );
          break;
        case "bulkEditCollectionAccess":
          await this.bulkEditCollectionAccess(event.items, organization);
          break;
        case "assignToCollections":
          await this.bulkAssignToCollections(event.items);
          break;
        case "viewEvents":
          await this.viewEvents(event.item);
          break;
      }
    } finally {
      this.processingEvent$.next(false);
    }
  }

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  async editCipherAttachments(cipher: CipherView) {
    if (cipher.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      this.go({ cipherId: null, itemId: null });
      return;
    }

    const organization = await firstValueFrom(this.organization$);
    if (organization.maxStorageGb == null || organization.maxStorageGb === 0) {
      this.messagingService.send("upgradeOrganization", { organizationId: cipher.organizationId });
      return;
    }

    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
      organizationId: cipher.organizationId as OrganizationId,
      admin: true,
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      this.refresh();
    }
  }

  /** Opens the Add/Edit Dialog */
  async addCipher(cipherType?: CipherType) {
    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      "add",
      undefined,
      cipherType,
    );

    const collectionId: CollectionId | undefined = this.activeFilter.collectionId as CollectionId;

    const organization = await firstValueFrom(this.organization$);
    cipherFormConfig.initialValues = {
      organizationId: organization.id,
      collectionIds: collectionId ? [collectionId] : [],
    };

    await this.openVaultItemDialog("form", cipherFormConfig);
  }

  /**
   * Edit the given cipher or add a new cipher
   * @param cipherView - When set, the cipher to be edited
   * @param cloneCipher - `true` when the cipher should be cloned.
   */
  async editCipher(cipher: CipherView | undefined, cloneCipher: boolean) {
    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // didn't pass password prompt, so don't open add / edit modal
      this.go({ cipherId: null, itemId: null });
      return;
    }

    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      cloneCipher ? "clone" : "edit",
      cipher?.id as CipherId | undefined,
    );

    await this.openVaultItemDialog("form", cipherFormConfig, cipher);
  }

  /** Opens the view dialog for the given cipher unless password reprompt fails */
  async viewCipherById(cipher: CipherView) {
    if (!cipher) {
      return;
    }

    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // Didn't pass password prompt, so don't open add / edit modal.
      await this.go({ cipherId: null, itemId: null, action: null });
      return;
    }

    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openVaultItemDialog(
      "view",
      cipherFormConfig,
      cipher,
      this.activeFilter.collectionId as CollectionId,
    );
  }

  /**
   * Open the combined view / edit dialog for a cipher.
   */
  async openVaultItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
    cipher?: CipherView,
    activeCollectionId?: CollectionId,
  ) {
    const organization = await firstValueFrom(this.organization$);
    const disableForm = cipher ? !cipher.edit && !organization.canEditAllCiphers : false;
    // If the form is disabled, force the mode into `view`
    const dialogMode = disableForm ? "view" : mode;
    this.vaultItemDialogRef = VaultItemDialogComponent.open(this.dialogService, {
      mode: dialogMode,
      formConfig,
      disableForm,
      activeCollectionId,
      isAdminConsoleAction: true,
      restore: this.restore,
    });

    const result = await lastValueFrom(this.vaultItemDialogRef.closed);
    this.vaultItemDialogRef = undefined;

    // If the dialog was closed by deleting the cipher, refresh the vault.
    if (result === VaultItemDialogResult.Deleted || result === VaultItemDialogResult.Saved) {
      this.refresh();
    }

    // Clear the query params when the dialog closes
    await this.go({ cipherId: null, itemId: null, action: null });
  }

  async cloneCipher(cipher: CipherView) {
    if (cipher.login.hasFido2Credentials) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return false;
      }
    }

    await this.editCipher(cipher, true);
  }

  restore = async (c: CipherViewLike): Promise<boolean> => {
    const organization = await firstValueFrom(this.organization$);
    if (!CipherViewLikeUtils.isDeleted(c)) {
      return false;
    }

    if (
      !organization.permissions.editAnyCollection &&
      !c.edit &&
      !organization.allowAdminAccessToAllCollectionItems
    ) {
      this.showMissingPermissionsError();
      return false;
    }

    if (!(await this.repromptCipher([c]))) {
      return false;
    }

    // Allow restore of an Unassigned Item
    try {
      if (c.id == null) {
        throw new Error("Cipher must have an Id to be restored");
      }
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const organization = await firstValueFrom(this.organization$);
      const asAdmin = organization.canEditAnyCollection || CipherViewLikeUtils.isUnassigned(c);
      await this.cipherService.restoreWithServer(c.id as CipherId, activeUserId, asAdmin);
      this.toastService.showToast({
        variant: "success",

        message: this.i18nService.t("restoredItem"),
      });
      this.refresh();
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  };

  async bulkRestore(ciphers: CipherView[]) {
    const organization = await firstValueFrom(this.organization$);
    if (
      !organization.permissions.editAnyCollection &&
      ciphers.some((c) => !c.edit && !organization.allowAdminAccessToAllCollectionItems)
    ) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    // assess if there are unassigned ciphers and/or editable ciphers selected in bulk for restore
    const editAccessCiphers: string[] = [];
    const unassignedCiphers: string[] = [];

    const userId = await firstValueFrom(this.userId$);
    // If user has edit all Access no need to check for unassigned ciphers
    if (organization.canEditAllCiphers) {
      ciphers.map((cipher) => {
        editAccessCiphers.push(cipher.id);
      });
    } else {
      ciphers.map((cipher) => {
        if (cipher.collectionIds.length === 0) {
          unassignedCiphers.push(cipher.id);
        } else if (cipher.edit) {
          editAccessCiphers.push(cipher.id);
        }
      });
    }

    if (unassignedCiphers.length === 0 && editAccessCiphers.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    if (unassignedCiphers.length > 0 || editAccessCiphers.length > 0) {
      await this.cipherService.restoreManyWithServer(
        [...unassignedCiphers, ...editAccessCiphers],
        userId,
        organization.id,
      );
    }

    this.toastService.showToast({
      variant: "success",

      message: this.i18nService.t("restoredItems"),
    });
    this.refresh();
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
    const organization = await firstValueFrom(this.organization$);
    if (!c.edit && !organization.canEditAllCiphers) {
      this.showMissingPermissionsError();
      return false;
    }

    if (!(await this.repromptCipher([c]))) {
      return false;
    }

    const permanent = c.isDeleted;

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: permanent ? "permanentlyDeleteItem" : "deleteItem" },
      content: { key: permanent ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.deleteCipherWithServer(c.id, activeUserId, permanent, c.isUnassigned);
      this.toastService.showToast({
        variant: "success",

        message: this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem"),
      });
      this.refresh();
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
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
      await this.collectionService.delete([collection.id], userId);
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
          queryParams: { collectionId: selectedCollection.parent.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }

      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkDelete(
    ciphers: CipherView[],
    collections: CollectionView[],
    organization: Organization,
  ) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    // Allow bulk deleting of Unassigned Items
    const unassignedCiphers: string[] = [];
    const assignedCiphers: string[] = [];

    ciphers.map((c) => {
      if (c.isUnassigned) {
        unassignedCiphers.push(c.id);
      } else {
        assignedCiphers.push(c.id);
      }
    });

    if (ciphers.length === 0 && collections.length === 0) {
      this.toastService.showToast({
        variant: "error",

        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const org = await firstValueFrom(this.organization$);
    const canDeleteCollections =
      collections == null || collections.every((c) => c.canDelete(organization));
    const canDeleteCiphers =
      ciphers == null || ciphers.every((c) => c.edit) || org.canEditAllCiphers;

    if (!canDeleteCiphers || !canDeleteCollections) {
      this.showMissingPermissionsError();
      return;
    }

    const filter = await firstValueFrom(this.filter$);
    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: {
        permanent: filter.type === "trash",
        cipherIds: assignedCiphers,
        collections: collections,
        organization,
        unassignedCiphers,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkDeleteDialogResult.Deleted) {
      this.refresh();
    }
  }

  async copy(cipher: CipherView, field: "username" | "password" | "totp") {
    let aType;
    let value;
    let typeI18nKey;

    if (field === "username") {
      aType = "Username";
      value = cipher.login.username;
      typeI18nKey = "username";
    } else if (field === "password") {
      aType = "Password";
      value = cipher.login.password;
      typeI18nKey = "password";
    } else if (field === "totp") {
      aType = "TOTP";
      const totpResponse = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
      value = totpResponse.code;
      typeI18nKey = "verificationCodeTotp";
    } else {
      this.toastService.showToast({
        variant: "error",

        message: this.i18nService.t("unexpectedError"),
      });
      return;
    }

    if (
      this.passwordRepromptService.protectedFields().includes(aType) &&
      !(await this.repromptCipher([cipher]))
    ) {
      return;
    }

    if (!cipher.viewPassword) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.toastService.showToast({
      variant: "info",

      message: this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    });

    if (field === "password") {
      await this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (field === "totp") {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientCopiedHiddenField,
        cipher.id,
      );
    }
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
          queryParams: { collectionId: selectedCollection.parent.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
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

  async bulkAssignToCollections(items: CipherView[]) {
    if (items.length === 0) {
      this.toastService.showToast({
        variant: "error",

        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const availableCollections = await firstValueFrom(this.editableCollections$);

    const organization = await firstValueFrom(this.organization$);
    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers: items,
        organizationId: organization.id,
        availableCollections,
        activeCollection: this.activeFilter.selectedCollectionNode.node,
        isSingleCipherAdmin:
          items.length === 1 && (organization.canEditAllCiphers || items[0].isUnassigned),
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionAssignmentResult.Saved) {
      this.refresh();
    }
  }

  async viewEvents(cipher: CipherView) {
    const organization = await firstValueFrom(this.organization$);
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: cipher.name,
        organizationId: organization.id,
        entityId: cipher.id,
        showUser: true,
        entity: "cipher",
      },
    });
  }

  protected async deleteCipherWithServer(
    id: string,
    userId: UserId,
    permanent: boolean,
    isUnassigned: boolean,
  ) {
    const organization = await firstValueFrom(this.organization$);
    const asAdmin = organization.canEditAllCiphers || isUnassigned;
    return permanent
      ? this.cipherService.deleteWithServer(id, userId, asAdmin)
      : this.cipherService.softDeleteWithServer(id, userId, asAdmin);
  }

  protected async repromptCipher(ciphers: CipherViewLike[]) {
    const notProtected = !ciphers.find((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  private refresh() {
    this.refreshingSubject$.next(true);
    if (this.vaultItemsComponent) {
      this.vaultItemsComponent.clearSelection();
    }
  }

  private go(queryParams: any = null) {
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
    });
  }

  protected readonly CollectionDialogTabType = CollectionDialogTabType;

  private showMissingPermissionsError() {
    this.toastService.showToast({
      variant: "error",

      message: this.i18nService.t("missingPermissions"),
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
