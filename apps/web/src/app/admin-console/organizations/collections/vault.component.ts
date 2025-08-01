import { ActivatedRoute, Params, Router } from "@angular/router";
import {
  All,
  RoutedVaultFilterModel,
} from "../../../vault/individual-vault/vault-filter/shared/models/routed-vault-filter.model";
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
  BannerModule,
  DialogRef,
  DialogService,
  Icons,
  NoItemsModule,
  ToastService,
} from "@bitwarden/components";
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  firstValueFrom,
  from,
  lastValueFrom,
  of,
} from "rxjs";
import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "./bulk-collections-dialog";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "../../../vault/individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  CollectionAdminService,
  CollectionAdminView,
  CollectionService,
  CollectionView,
  Unassigned,
} from "@bitwarden/admin-console/common";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../shared/components/collection-dialog";
import { GroupApiService, GroupView } from "../core";
import {
  ResellerWarning,
  ResellerWarningService,
} from "../../../billing/services/reseller-warning.service";
import {
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "../../../vault/components/vault-item-dialog/vault-item-dialog.component";
import {
  catchError,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  filter,
  first,
  map,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from "rxjs/operators";
import { getFlatCollectionTree, getNestedCollectionTree } from "./utils";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AssignCollectionsWebComponent } from "../../../vault/components/assign-collections";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { BillingNotificationService } from "../../../billing/services/billing-notification.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionAccessRestrictedComponent } from "./collection-access-restricted.component";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { FreeTrial } from "../../../billing/types/free-trial";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationFreeTrialWarningComponent } from "@bitwarden/web-vault/app/billing/organizations/warnings/components/organization-free-trial-warning.component";
import { OrganizationResellerRenewalWarningComponent } from "@bitwarden/web-vault/app/billing/organizations/warnings/components/organization-reseller-renewal-warning.component";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services/organization-warnings.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { RoutedVaultFilterBridgeService } from "../../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { SharedModule } from "../../../shared";
import { SyncService } from "@bitwarden/common/platform/sync";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { TrialFlowService } from "../../../billing/services/trial-flow.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { VaultFilter } from "../../../vault/individual-vault/vault-filter/shared/models/vault-filter.model";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultFilterService } from "../../../vault/individual-vault/vault-filter/services/abstractions/vault-filter.service";
import { VaultHeaderComponent } from "./vault-header/vault-header.component";
import { VaultItemEvent } from "../../../vault/components/vault-items/vault-item-event";
import { VaultItemsComponent } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-items.component";
import { VaultItemsModule } from "../../../vault/components/vault-items/vault-items.module";
import { createFilterFunction } from "../../../vault/individual-vault/vault-filter/shared/models/filter-function";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { openEntityEventsDialog } from "../manage/entity-events.component";

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
export class VaultComponent implements OnInit, OnDestroy {
  protected Unassigned = Unassigned;

  trashCleanupWarning: string = null;
  activeFilter: VaultFilter = new VaultFilter();

  protected showAddAccessToggle = false;
  protected noItemIcon = Icons.Search;
  protected performingInitialLoad = true;
  protected refreshing = false;
  protected processingEvent = false;
  protected filter: RoutedVaultFilterModel = {};
  protected organization: Organization;
  protected allCollections: CollectionAdminView[];
  protected allGroups: GroupView[];
  protected ciphers: CipherView[];
  protected collections: CollectionAdminView[];
  protected selectedCollection: TreeNode<CollectionAdminView> | undefined;
  protected isEmpty: boolean;
  protected showCollectionAccessRestricted: boolean;
  private hasSubscription$ = new BehaviorSubject<boolean>(false);
  protected currentSearchText$: Observable<string>;
  protected useOrganizationWarningsService$: Observable<boolean>;
  protected freeTrialWhenWarningsServiceDisabled$: Observable<FreeTrial>;
  protected resellerWarningWhenWarningsServiceDisabled$: Observable<ResellerWarning | null>;
  protected prevCipherId: string | null = null;
  protected userId: UserId;
  /**
   * A list of collections that the user can assign items to and edit those items within.
   * @protected
   */
  protected editableCollections$: Observable<CollectionAdminView[]>;
  protected allCollectionsWithoutUnassigned$: Observable<CollectionAdminView[]>;

  protected get hideVaultFilters(): boolean {
    return this.organization?.isProviderUser && !this.organization?.isMember;
  }

  private searchText$ = new Subject<string>();
  private refresh$ = new BehaviorSubject<void>(null);
  private destroy$ = new Subject<void>();
  protected addAccessStatus$ = new BehaviorSubject<AddAccessStatusType>(0);
  private vaultItemDialogRef?: DialogRef<VaultItemDialogResult> | undefined;

  @ViewChild("vaultItems", { static: false }) vaultItemsComponent: VaultItemsComponent<CipherView>;

  private readonly unpaidSubscriptionDialog$ = this.accountService.activeAccount$.pipe(
    map((account) => account?.id),
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
  ) {}

  async ngOnInit() {
    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning",
    );

    const filter$ = this.routedVaultFilterService.filter$;

    // FIXME: The RoutedVaultFilterModel uses `organizationId: Unassigned` to represent the individual vault,
    // but that is never used in Admin Console. This function narrows the type so it doesn't pollute our code here,
    // but really we should change to using our own vault filter model that only represents valid states in AC.
    const isOrganizationId = (value: OrganizationId | Unassigned): value is OrganizationId =>
      value !== Unassigned;
    const organizationId$ = filter$.pipe(
      map((filter) => filter.organizationId),
      filter((filter) => filter !== undefined),
      filter(isOrganizationId),
      distinctUntilChanged(),
    );

    const organization$ = this.accountService.activeAccount$.pipe(
      map((account) => account?.id),
      switchMap((id) =>
        organizationId$.pipe(
          switchMap((organizationId) =>
            this.organizationService
              .organizations$(id)
              .pipe(map((organizations) => organizations.find((org) => org.id === organizationId))),
          ),
          takeUntil(this.destroy$),
          shareReplay({ refCount: false, bufferSize: 1 }),
        ),
      ),
    );

    const firstSetup$ = combineLatest([organization$, this.route.queryParams]).pipe(
      first(),
      switchMap(async ([organization]) => {
        this.organization = organization;

        if (!organization.canEditAnyCollection) {
          await this.syncService.fullSync(false);
        }

        return undefined;
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

    this.currentSearchText$ = this.route.queryParams.pipe(map((queryParams) => queryParams.search));

    this.allCollectionsWithoutUnassigned$ = this.refresh$.pipe(
      switchMap(() => organizationId$),
      switchMap((orgId) => this.collectionAdminService.getAll(orgId)),
      shareReplay({ refCount: false, bufferSize: 1 }),
    );

    this.editableCollections$ = this.allCollectionsWithoutUnassigned$.pipe(
      map((collections) => {
        // Users that can edit all ciphers can implicitly add to / edit within any collection
        if (this.organization.canEditAllCiphers) {
          return collections;
        }
        return collections.filter((c) => c.assigned);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const allCollections$ = combineLatest([
      organizationId$,
      this.allCollectionsWithoutUnassigned$,
    ]).pipe(
      map(([organizationId, allCollections]) => {
        // FIXME: We should not assert that the Unassigned type is a CollectionId.
        // Instead we should consider representing the Unassigned collection as a different object, given that
        // it is not actually a collection.
        const noneCollection = new CollectionAdminView();
        noneCollection.name = this.i18nService.t("unassigned");
        noneCollection.id = Unassigned as CollectionId;
        noneCollection.organizationId = organizationId;
        return allCollections.concat(noneCollection);
      }),
    );

    const allGroups$ = organizationId$.pipe(
      switchMap((organizationId) => this.groupService.getAll(organizationId)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const allCiphers$ = combineLatest([organization$, this.refresh$]).pipe(
      switchMap(async ([organization]) => {
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
          ciphers?.forEach((c) => (c.edit = true));
        } else {
          // Otherwise, only fetch ciphers they have access to (includes unassigned for admins).
          ciphers = await this.cipherService.getManyFromApiForOrganization(organization.id);
        }

        await this.searchService.indexCiphers(this.userId, ciphers, organization.id);
        return ciphers;
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const allCipherMap$ = allCiphers$.pipe(
      map((ciphers) => {
        return Object.fromEntries(ciphers.map((c) => [c.id, c]));
      }),
    );

    const nestedCollections$ = allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const collections$ = combineLatest([
      nestedCollections$,
      filter$,
      this.currentSearchText$,
      this.addAccessStatus$,
    ]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      concatMap(async ([collections, filter, searchText, addAccessStatus]) => {
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

        if (await this.searchService.isSearchable(this.userId, searchText)) {
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
          !this.organization.allowAdminAccessToAllCollectionItems &&
          this.organization.canEditUnmanagedCollections &&
          collectionsToReturn.some((c) => c.unmanaged);

        if (addAccessStatus === 1 && this.showAddAccessToggle) {
          collectionsToReturn = collectionsToReturn.filter((c) => c.unmanaged);
        }
        return collectionsToReturn;
      }),
      takeUntil(this.destroy$),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const selectedCollection$ = combineLatest([nestedCollections$, filter$]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      map(([collections, filter]) => {
        if (
          filter.collectionId === undefined ||
          filter.collectionId === All ||
          filter.collectionId === Unassigned
        ) {
          return undefined;
        }

        return ServiceUtils.getTreeNodeObjectFromList(collections, filter.collectionId);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const showCollectionAccessRestricted$ = combineLatest([
      filter$,
      selectedCollection$,
      organization$,
    ]).pipe(
      map(([filter, collection, organization]) => {
        return (
          (filter.collectionId === Unassigned && !organization.canEditUnassignedCiphers) ||
          (!organization.canEditAllCiphers && collection != undefined && !collection.node.assigned)
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const ciphers$ = combineLatest([
      allCiphers$,
      filter$,
      this.currentSearchText$,
      showCollectionAccessRestricted$,
    ]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, searchText, showCollectionAccessRestricted]) => {
        if (filter.collectionId === undefined && filter.type === undefined) {
          return [];
        }

        if (showCollectionAccessRestricted) {
          // Do not show ciphers for restricted collections
          // Ciphers belonging to multiple collections may still be present in $allCiphers and shouldn't be visible
          return [];
        }

        const filterFunction = createFilterFunction(filter);

        if (await this.searchService.isSearchable(this.userId, searchText)) {
          return await this.searchService.searchCiphers<CipherView>(
            this.userId,
            searchText,
            [filterFunction],
            ciphers,
          );
        }

        return ciphers.filter(filterFunction);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

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
              title: null,
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

    firstSetup$
      .pipe(
        switchMap(() => combineLatest([this.route.queryParams, organization$, allCiphers$])),
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
              title: null,
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

    // Billing Warnings
    this.useOrganizationWarningsService$ = this.configService.getFeatureFlag$(
      FeatureFlag.UseOrganizationWarningsService,
    );

    this.useOrganizationWarningsService$
      .pipe(
        switchMap((enabled) =>
          enabled
            ? this.organizationWarningsService.showInactiveSubscriptionDialog$(this.organization)
            : this.unpaidSubscriptionDialog$,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.organizationWarningsService
      .showSubscribeBeforeFreeTrialEndsDialog$(this.organization)
      .pipe(takeUntil(this.destroy$))
      .subscribe();

    const freeTrial$ = combineLatest([
      organization$,
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
            catchError((error: unknown) => {
              this.billingNotificationService.handleError(error);
              return of(null);
            }),
          ),
        ]),
      ),
      map(([org, sub, paymentSource]) =>
        this.trialFlowService.checkForOrgsWithUpcomingPaymentIssues(org, sub, paymentSource),
      ),
      filter((result) => result !== null),
    );

    this.freeTrialWhenWarningsServiceDisabled$ = this.useOrganizationWarningsService$.pipe(
      filter((enabled) => !enabled),
      switchMap(() => freeTrial$),
    );

    const resellerWarning$ = organization$.pipe(
      filter((org) => org.isOwner),
      switchMap((org) =>
        from(this.billingApiService.getOrganizationBillingMetadata(org.id)).pipe(
          map((metadata) => ({ org, metadata })),
        ),
      ),
      map(({ org, metadata }) => this.resellerWarningService.getWarning(org, metadata)),
    );

    this.resellerWarningWhenWarningsServiceDisabled$ = this.useOrganizationWarningsService$.pipe(
      filter((enabled) => !enabled),
      switchMap(() => resellerWarning$),
    );
    // End Billing Warnings

    firstSetup$
      .pipe(
        switchMap(() => this.refresh$),
        tap(() => (this.refreshing = true)),
        switchMap(() =>
          combineLatest([
            organization$,
            filter$,
            allCollections$,
            allGroups$,
            ciphers$,
            collections$,
            selectedCollection$,
            showCollectionAccessRestricted$,
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(
        ([
          organization,
          filter,
          allCollections,
          allGroups,
          ciphers,
          collections,
          selectedCollection,
          showCollectionAccessRestricted,
        ]) => {
          this.organization = organization;
          this.filter = filter;
          this.allCollections = allCollections;
          this.allGroups = allGroups;
          this.ciphers = ciphers;
          this.collections = collections;
          this.selectedCollection = selectedCollection;
          this.showCollectionAccessRestricted = showCollectionAccessRestricted;

          this.isEmpty = collections?.length === 0 && ciphers?.length === 0;

          // This is a temporary fix to avoid double fetching collections.
          // TODO: Remove when implementing new VVR menu
          this.vaultFilterService.reloadCollections(allCollections);

          this.refreshing = false;
          this.performingInitialLoad = false;
        },
      );
  }

  async navigateToPaymentMethod() {
    const managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
      FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
    );
    const route = managePaymentDetailsOutsideCheckout ? "payment-details" : "payment-method";
    await this.router.navigate(["organizations", `${this.organization?.id}`, "billing", route], {
      state: { launchPaymentModalAutomatically: true },
    });
  }

  addAccessToggle(e: AddAccessStatusType) {
    this.addAccessStatus$.next(e);
  }

  get loading() {
    return this.refreshing || this.processingEvent;
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onVaultItemsEvent(event: VaultItemEvent<CipherView>) {
    this.processingEvent = true;

    try {
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
            .map((i) => i.cipher);
          const collections = event.items
            .filter((i) => i.cipher === undefined)
            .map((i) => i.collection);
          if (ciphers.length === 1 && collections.length === 0) {
            await this.deleteCipher(ciphers[0]);
          } else if (ciphers.length === 0 && collections.length === 1) {
            await this.deleteCollection(collections[0] as CollectionAdminView);
          } else {
            await this.bulkDelete(ciphers, collections, this.organization);
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
          await this.bulkEditCollectionAccess(event.items, this.organization);
          break;
        case "assignToCollections":
          await this.bulkAssignToCollections(event.items);
          break;
        case "viewEvents":
          await this.viewEvents(event.item);
          break;
      }
    } finally {
      this.processingEvent = false;
    }
  }

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  async editCipherAttachments(cipher: CipherView) {
    if (cipher?.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      this.go({ cipherId: null, itemId: null });
      return;
    }

    if (this.organization.maxStorageGb == null || this.organization.maxStorageGb === 0) {
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
      result.action === AttachmentDialogResult.Removed ||
      result.action === AttachmentDialogResult.Uploaded
    ) {
      this.refresh();
    }
  }

  /** Opens the Add/Edit Dialog */
  async addCipher(cipherType?: CipherType) {
    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      "add",
      null,
      cipherType,
    );

    const collectionId: CollectionId | undefined = this.activeFilter.collectionId as CollectionId;

    cipherFormConfig.initialValues = {
      organizationId: this.organization.id as OrganizationId,
      collectionIds: collectionId ? [collectionId] : [],
    };

    await this.openVaultItemDialog("form", cipherFormConfig);
  }

  /**
   * Edit the given cipher or add a new cipher
   * @param cipherView - When set, the cipher to be edited
   * @param cloneCipher - `true` when the cipher should be cloned.
   */
  async editCipher(cipher: CipherView | null, cloneCipher: boolean) {
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
      cipher?.id as CipherId | null,
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
    const disableForm = cipher ? !cipher.edit && !this.organization.canEditAllCiphers : false;
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
    if (cipher.login?.hasFido2Credentials) {
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

  restore = async (c: CipherView): Promise<boolean> => {
    if (!c.isDeleted) {
      return;
    }

    if (
      !this.organization.permissions.editAnyCollection &&
      !c.edit &&
      !this.organization.allowAdminAccessToAllCollectionItems
    ) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher([c]))) {
      return;
    }

    // Allow restore of an Unassigned Item
    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const asAdmin = this.organization?.canEditAnyCollection || c.isUnassigned;
      await this.cipherService.restoreWithServer(c.id, activeUserId, asAdmin);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("restoredItem"),
      });
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  };

  async bulkRestore(ciphers: CipherView[]) {
    if (
      !this.organization.permissions.editAnyCollection &&
      ciphers.some((c) => !c.edit && !this.organization.allowAdminAccessToAllCollectionItems)
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

    // If user has edit all Access no need to check for unassigned ciphers
    if (this.organization.canEditAllCiphers) {
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
        this.userId,
        this.organization.id,
      );
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("restoredItems"),
    });
    this.refresh();
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
    if (!c.edit && !this.organization.canEditAllCiphers) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher([c]))) {
      return;
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
        title: null,
        message: this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem"),
      });
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async deleteCollection(collection: CollectionAdminView): Promise<void> {
    if (!collection.canDelete(this.organization)) {
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
      await this.apiService.deleteCollection(this.organization?.id, collection.id);
      await this.collectionService.delete([collection.id as CollectionId], this.userId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedCollectionId", collection.name),
      });

      // Clear the cipher cache to clear the deleted collection from the cipher state
      await this.cipherService.clear();

      // Navigate away if we deleted the collection we were viewing
      if (this.selectedCollection?.node.id === collection.id) {
        void this.router.navigate([], {
          queryParams: { collectionId: this.selectedCollection.parent?.node.id ?? null },
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
        title: null,
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const canDeleteCollections =
      collections == null || collections.every((c) => c.canDelete(organization));
    const canDeleteCiphers =
      ciphers == null || ciphers.every((c) => c.edit) || this.organization.canEditAllCiphers;

    if (!canDeleteCiphers || !canDeleteCollections) {
      this.showMissingPermissionsError();
      return;
    }

    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: {
        permanent: this.filter.type === "trash",
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
      value = totpResponse?.code;
      typeI18nKey = "verificationCodeTotp";
    } else {
      this.toastService.showToast({
        variant: "error",
        title: null,
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
      title: null,
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
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: this.organization?.id,
        parentCollectionId: this.selectedCollection?.node.id,
        limitNestedCollections: !this.organization.canEditAnyCollection,
        isAdminConsoleActive: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (
      result.action === CollectionDialogAction.Saved ||
      result.action === CollectionDialogAction.Deleted
    ) {
      this.refresh();
    }
  }

  async editCollection(
    c: CollectionAdminView,
    tab: CollectionDialogTabType,
    readonly: boolean,
  ): Promise<void> {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        collectionId: c?.id,
        organizationId: this.organization?.id,
        initialTab: tab,
        readonly: readonly,
        isAddAccessCollection: c.unmanaged,
        limitNestedCollections: !this.organization.canEditAnyCollection,
        isAdminConsoleActive: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (
      result.action === CollectionDialogAction.Saved ||
      result.action === CollectionDialogAction.Deleted
    ) {
      this.refresh();

      // If we deleted the selected collection, navigate up/away
      if (
        result.action === CollectionDialogAction.Deleted &&
        this.selectedCollection?.node.id === c?.id
      ) {
        void this.router.navigate([], {
          queryParams: { collectionId: this.selectedCollection.parent?.node.id ?? null },
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
        title: null,
        message: this.i18nService.t("noCollectionsSelected"),
      });
      return;
    }

    if (collections.some((c) => !c.canEdit(organization))) {
      this.showMissingPermissionsError();
      return;
    }

    const dialog = BulkCollectionsDialogComponent.open(this.dialogService, {
      data: {
        collections,
        organizationId: this.organization?.id,
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
        title: null,
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const availableCollections = await firstValueFrom(this.editableCollections$);

    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers: items,
        organizationId: this.organization?.id as OrganizationId,
        availableCollections,
        activeCollection: this.activeFilter?.selectedCollectionNode?.node,
        isSingleCipherAdmin:
          items.length === 1 && (this.organization?.canEditAllCiphers || items[0].isUnassigned),
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionAssignmentResult.Saved) {
      this.refresh();
    }
  }

  async viewEvents(cipher: CipherView) {
    await openEntityEventsDialog(this.dialogService, {
      data: {
        name: cipher.name,
        organizationId: this.organization.id,
        entityId: cipher.id,
        showUser: true,
        entity: "cipher",
      },
    });
  }

  protected deleteCipherWithServer(
    id: string,
    userId: UserId,
    permanent: boolean,
    isUnassigned: boolean,
  ) {
    const asAdmin = this.organization?.canEditAllCiphers || isUnassigned;
    return permanent
      ? this.cipherService.deleteWithServer(id, userId, asAdmin)
      : this.cipherService.softDeleteWithServer(id, userId, asAdmin);
  }

  protected async repromptCipher(ciphers: CipherView[]) {
    const notProtected = !ciphers.find((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  private refresh() {
    this.refresh$.next();
    this.vaultItemsComponent?.clearSelection();
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
      title: null,
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
