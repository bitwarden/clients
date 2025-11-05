// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  lastValueFrom,
  Observable,
  Subject,
} from "rxjs";
import {
  concatMap,
  debounceTime,
  distinctUntilChanged,
  filter,
  first,
  map,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";

import {
  CollectionData,
  CollectionDetailsResponse,
  CollectionService,
  CollectionView,
  Unassigned,
} from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import {
  NoResults,
  DeactivatedOrg,
  EmptyTrash,
  FavoritesIcon,
  ItemTypes,
  Icon,
} from "@bitwarden/assets/svg";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { EventType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { CipherListView } from "@bitwarden/sdk-internal";
import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogResult,
  AttachmentDialogCloseResult,
  AttachmentDialogResult,
  AttachmentsV2Component,
  CipherFormConfig,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
} from "@bitwarden/vault";
import { UnifiedUpgradePromptService } from "@bitwarden/web-vault/app/billing/individual/upgrade/services";
import { OrganizationWarningsModule } from "@bitwarden/web-vault/app/billing/organizations/warnings/organization-warnings.module";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import {
  getNestedCollectionTree,
  getFlatCollectionTree,
} from "../../admin-console/organizations/collections";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../admin-console/organizations/shared/components/collection-dialog";
import { SharedModule } from "../../shared/shared.module";
import { AssignCollectionsWebComponent } from "../components/assign-collections";
import {
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "../components/vault-item-dialog/vault-item-dialog.component";
import { VaultItem } from "../components/vault-items/vault-item";
import { VaultItemEvent } from "../components/vault-items/vault-item-event";
import { VaultItemsComponent } from "../components/vault-items/vault-items.component";
import { VaultItemsModule } from "../components/vault-items/vault-items.module";

import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "./bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import {
  BulkMoveDialogResult,
  openBulkMoveDialog,
} from "./bulk-action-dialogs/bulk-move-dialog/bulk-move-dialog.component";
import { VaultBannersComponent } from "./vault-banners/vault-banners.component";
import { VaultFilterComponent } from "./vault-filter/components/vault-filter.component";
import { VaultFilterService } from "./vault-filter/services/abstractions/vault-filter.service";
import { RoutedVaultFilterBridgeService } from "./vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "./vault-filter/services/routed-vault-filter.service";
import { createFilterFunction } from "./vault-filter/shared/models/filter-function";
import {
  All,
  RoutedVaultFilterModel,
} from "./vault-filter/shared/models/routed-vault-filter.model";
import { VaultFilter } from "./vault-filter/shared/models/vault-filter.model";
import { FolderFilter, OrganizationFilter } from "./vault-filter/shared/models/vault-filter.type";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultHeaderComponent } from "./vault-header/vault-header.component";
import { VaultOnboardingComponent } from "./vault-onboarding/vault-onboarding.component";

const BroadcasterSubscriptionId = "VaultComponent";

type EmptyStateType = "trash" | "favorites" | "archive";

type EmptyStateItem = {
  title: string;
  description: string;
  icon: Icon;
};

type EmptyStateMap = Record<EmptyStateType, EmptyStateItem>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault",
  templateUrl: "vault.component.html",
  imports: [
    VaultHeaderComponent,
    VaultOnboardingComponent,
    VaultBannersComponent,
    VaultFilterModule,
    VaultItemsModule,
    SharedModule,
    OrganizationWarningsModule,
  ],
  providers: [
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
    DefaultCipherFormConfigService,
  ],
})
export class VaultComponent<C extends CipherViewLike> implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("vaultFilter", { static: true }) filterComponent: VaultFilterComponent;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("vaultItems", { static: false }) vaultItemsComponent: VaultItemsComponent<C>;

  trashCleanupWarning: string = null;
  kdfIterations: number;
  activeFilter: VaultFilter = new VaultFilter();

  protected deactivatedOrgIcon = DeactivatedOrg;
  protected emptyTrashIcon = EmptyTrash;
  protected favoritesIcon = FavoritesIcon;
  protected itemTypesIcon = ItemTypes;
  protected noResultsIcon = NoResults;
  protected performingInitialLoad = true;
  protected refreshing = false;
  protected processingEvent = false;
  protected filter: RoutedVaultFilterModel = {};
  protected showBulkMove: boolean;
  protected canAccessPremium: boolean;
  protected allCollections: CollectionView[];
  protected allOrganizations: Organization[] = [];
  protected ciphers: C[];
  protected collections: CollectionView[];
  protected isEmpty: boolean;
  protected selectedCollection: TreeNode<CollectionView> | undefined;
  protected canCreateCollections = false;
  protected currentSearchText$: Observable<string> = this.route.queryParams.pipe(
    map((queryParams) => queryParams.search),
  );
  private searchText$ = new Subject<string>();
  private refresh$ = new BehaviorSubject<void>(null);
  private destroy$ = new Subject<void>();

  private vaultItemDialogRef?: DialogRef<VaultItemDialogResult> | undefined;
  protected showAddCipherBtn: boolean = false;

  organizations$ = this.accountService.activeAccount$
    .pipe(map((a) => a?.id))
    .pipe(switchMap((id) => this.organizationService.organizations$(id)));

  protected userCanArchive$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => {
      return this.cipherArchiveService.userCanArchive$(userId);
    }),
  );

  emptyState$ = combineLatest([
    this.currentSearchText$,
    this.routedVaultFilterService.filter$,
    this.organizations$,
  ]).pipe(
    map(([searchText, filter, organizations]) => {
      const selectedOrg = organizations?.find((org) => org.id === filter.organizationId);
      const isOrgDisabled = selectedOrg && !selectedOrg.enabled;

      if (isOrgDisabled) {
        this.showAddCipherBtn = false;
        return {
          title: "organizationIsSuspended",
          description: "organizationIsSuspendedDesc",
          icon: this.deactivatedOrgIcon,
        };
      }

      if (searchText) {
        return {
          title: "noSearchResults",
          description: "clearFiltersOrTryAnother",
          icon: this.noResultsIcon,
        };
      }

      const emptyStateMap: EmptyStateMap = {
        trash: {
          title: "noItemsInTrash",
          description: "noItemsInTrashDesc",
          icon: this.emptyTrashIcon,
        },
        favorites: {
          title: "emptyFavorites",
          description: "emptyFavoritesDesc",
          icon: this.favoritesIcon,
        },
        archive: {
          title: "noItemsInArchive",
          description: "noItemsInArchiveDesc",
          icon: this.itemTypesIcon,
        },
      };

      if (filter?.type && filter.type in emptyStateMap) {
        this.showAddCipherBtn = false;
        return emptyStateMap[filter.type as EmptyStateType];
      }

      this.showAddCipherBtn = true;
      return {
        title: "noItemsInVault",
        description: "emptyVaultDescription",
        icon: this.itemTypesIcon,
      };
    }),
  );

  protected enforceOrgDataOwnershipPolicy$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
    ),
  );

  private userId$ = this.accountService.activeAccount$.pipe(getUserId);

  constructor(
    private syncService: SyncService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private organizationService: OrganizationService,
    private vaultFilterService: VaultFilterService,
    private routedVaultFilterService: RoutedVaultFilterService,
    private routedVaultFilterBridgeService: RoutedVaultFilterBridgeService,
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService,
    private collectionService: CollectionService,
    private logService: LogService,
    private totpService: TotpService,
    private eventCollectionService: EventCollectionService,
    private searchService: SearchService,
    private searchPipe: SearchPipe,
    private apiService: ApiService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
    private accountService: AccountService,
    private cipherFormConfigService: DefaultCipherFormConfigService,
    protected billingApiService: BillingApiServiceAbstraction,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private cipherArchiveService: CipherArchiveService,
    private organizationWarningsService: OrganizationWarningsService,
    private policyService: PolicyService,
    private unifiedUpgradePromptService: UnifiedUpgradePromptService,
    private premiumUpgradePromptService: PremiumUpgradePromptService,
  ) {}

  async ngOnInit() {
    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning",
    );

    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const firstSetup$ = this.route.queryParams.pipe(
      first(),
      switchMap(async (params: Params) => {
        await this.syncService.fullSync(false);

        const cipherId = getCipherIdFromParams(params);
        if (!cipherId) {
          return;
        }
        const cipherView = new CipherView();
        cipherView.id = cipherId;
        if (params.action === "clone") {
          await this.cloneCipher(cipherView);
        } else if (params.action === "view") {
          await this.viewCipher(cipherView);
        } else if (params.action === "edit") {
          await this.editCipher(cipherView);
        }
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
      });

    const filter$ = this.routedVaultFilterService.filter$;

    const allCollections$ = this.collectionService.decryptedCollections$(activeUserId);
    const nestedCollections$ = allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections)),
    );

    this.searchText$
      .pipe(
        debounceTime(SearchTextDebounceInterval),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((searchText) =>
        this.router.navigate([], {
          queryParams: { search: Utils.isNullOrEmpty(searchText) ? null : searchText },
          queryParamsHandling: "merge",
          replaceUrl: true,
        }),
      );

    const _ciphers = this.cipherService
      .cipherListViews$(activeUserId)
      .pipe(filter((c) => c !== null));

    /**
     * This observable filters the ciphers based on the active user ID and the restricted item types.
     */
    const allowedCiphers$ = combineLatest([
      _ciphers,
      this.restrictedItemTypesService.restricted$,
    ]).pipe(
      map(([ciphers, restrictedTypes]) =>
        ciphers.filter(
          (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, restrictedTypes),
        ),
      ),
    );

    const ciphers$ = combineLatest([
      allowedCiphers$,
      filter$,
      this.currentSearchText$,
      this.cipherArchiveService.hasArchiveFlagEnabled$(),
    ]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, searchText, archiveEnabled]) => {
        const failedCiphers =
          (await firstValueFrom(this.cipherService.failedToDecryptCiphers$(activeUserId))) ?? [];
        const filterFunction = createFilterFunction(filter, archiveEnabled);
        // Append any failed to decrypt ciphers to the top of the cipher list
        const allCiphers = [...failedCiphers, ...ciphers];

        if (await this.searchService.isSearchable(activeUserId, searchText)) {
          return await this.searchService.searchCiphers<C>(
            activeUserId,
            searchText,
            [filterFunction],
            allCiphers as C[],
          );
        }

        return ciphers.filter(filterFunction) as C[];
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const collections$ = combineLatest([nestedCollections$, filter$, this.currentSearchText$]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      concatMap(async ([collections, filter, searchText]) => {
        if (filter.collectionId === undefined || filter.collectionId === Unassigned) {
          return [];
        }
        let searchableCollectionNodes: TreeNode<CollectionView>[] = [];
        if (filter.organizationId !== undefined && filter.collectionId === All) {
          searchableCollectionNodes = collections.filter(
            (c) => c.node.organizationId === filter.organizationId,
          );
        } else if (filter.collectionId === All) {
          searchableCollectionNodes = collections;
        } else {
          const selectedCollection = ServiceUtils.getTreeNodeObjectFromList(
            collections,
            filter.collectionId,
          );
          searchableCollectionNodes = selectedCollection?.children ?? [];
        }

        if (await this.searchService.isSearchable(activeUserId, searchText)) {
          // Flatten the tree for searching through all levels
          const flatCollectionTree: CollectionView[] =
            getFlatCollectionTree(searchableCollectionNodes);

          return this.searchPipe.transform(
            flatCollectionTree,
            searchText,
            (collection) => collection.name,
            (collection) => collection.id,
          );
        }

        return searchableCollectionNodes.map((treeNode: TreeNode<CollectionView>) => treeNode.node);
      }),
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

    firstSetup$
      .pipe(
        switchMap(() => this.route.queryParams),
        // Only process the queryParams if the dialog is not open
        filter(() => this.vaultItemDialogRef == undefined),
        switchMap(async (params) => {
          const cipherId = getCipherIdFromParams(params);
          if (cipherId) {
            if (await this.cipherService.get(cipherId, activeUserId)) {
              let action = params.action;
              // Default to "view"
              if (action == null) {
                action = "view";
              }

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

              if (action === "view") {
                await this.viewCipherById(cipherId);
              } else {
                await this.editCipherId(cipherId);
              }
            } else {
              this.toastService.showToast({
                variant: "error",
                title: null,
                message: this.i18nService.t("unknownCipher"),
              });
              await this.router.navigate([], {
                queryParams: { itemId: null, cipherId: null },
                queryParamsHandling: "merge",
              });
            }
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    firstSetup$
      .pipe(
        switchMap(() => this.cipherService.failedToDecryptCiphers$(activeUserId)),
        filterOutNullish(),
        map((ciphers) => ciphers.filter((c) => !c.isDeleted)),
        filter((ciphers) => ciphers.length > 0),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe((ciphers) => {
        DecryptionFailureDialogComponent.open(this.dialogService, {
          cipherIds: ciphers.map((c) => c.id as CipherId),
        });
      });

    this.organizations$
      .pipe(
        filter((organizations) => organizations.length === 1),
        map((organizations) => organizations[0]),
        switchMap((organization) =>
          this.organizationWarningsService.showInactiveSubscriptionDialog$(organization),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();

    firstSetup$
      .pipe(
        switchMap(() => this.refresh$),
        tap(() => (this.refreshing = true)),
        switchMap(() =>
          combineLatest([
            filter$,
            this.billingAccountProfileStateService.hasPremiumFromAnySource$(activeUserId),
            allCollections$,
            this.organizations$,
            ciphers$,
            collections$,
            selectedCollection$,
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(
        ([
          filter,
          canAccessPremium,
          allCollections,
          allOrganizations,
          ciphers,
          collections,
          selectedCollection,
        ]) => {
          this.filter = filter;
          this.canAccessPremium = canAccessPremium;
          this.allCollections = allCollections;
          this.allOrganizations = allOrganizations;
          this.ciphers = ciphers;
          this.collections = collections;
          this.selectedCollection = selectedCollection;

          this.canCreateCollections = allOrganizations?.some(
            (o) => o.canCreateNewCollections && !o.isProviderUser,
          );

          this.showBulkMove = filter.type !== "trash";
          this.isEmpty = collections?.length === 0 && ciphers?.length === 0;
          this.performingInitialLoad = false;
          this.refreshing = false;

          // Explicitly mark for check to ensure the view is updated
          // Some sources are not always emitted within the Angular zone (e.g. ciphers updated via WS server notifications)
          this.changeDetectorRef.markForCheck();
        },
      );
    void this.unifiedUpgradePromptService.displayUpgradePromptConditionally();
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
    this.vaultFilterService.clearOrganizationFilter();
  }

  async onVaultItemsEvent(event: VaultItemEvent<C>) {
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
        case "delete":
          await this.handleDeleteEvent(event.items);
          break;
        case "moveToFolder":
          await this.bulkMove(event.items);
          break;
        case "copyField":
          await this.copy(event.item, event.field);
          break;
        case "editCollection":
          await this.editCollection(event.item, CollectionDialogTabType.Info);
          break;
        case "viewCollectionAccess":
          await this.editCollection(event.item, CollectionDialogTabType.Access);
          break;
        case "assignToCollections":
          await this.bulkAssignToCollections(event.items);
          break;
        case "archive":
          if (event.items.length === 1) {
            await this.archive(event.items[0]);
          } else {
            await this.bulkArchive(event.items);
          }
          break;
        case "unarchive":
          if (event.items.length === 1) {
            await this.unarchive(event.items[0]);
          } else {
            await this.bulkUnarchive(event.items);
          }
          break;
        case "toggleFavorite":
          await this.handleFavoriteEvent(event.item);
          break;
        case "editCipher":
          await this.editCipher(event.item);
          break;
      }
    } finally {
      this.processingEvent = false;
    }
  }

  async archive(cipher: C) {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);

    if (!repromptPassed) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveItem" },
      content: { key: "archiveItemConfirmDesc" },
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    const activeUserId = await firstValueFrom(this.userId$);
    try {
      await this.cipherArchiveService.archiveWithServer(cipher.id as CipherId, activeUserId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemWasSentToArchive"),
      });
      this.refresh();
    } catch (e) {
      this.logService.error("Error archiving cipher", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  async bulkArchive(ciphers: C[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveBulkItems" },
      content: { key: "archiveBulkItemsConfirmDesc" },
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    const activeUserId = await firstValueFrom(this.userId$);
    const cipherIds = ciphers.map((c) => c.id as CipherId);
    try {
      await this.cipherArchiveService.archiveWithServer(cipherIds as CipherId[], activeUserId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemsWereSentToArchive"),
      });
      this.refresh();
    } catch (e) {
      this.logService.error("Error archiving ciphers", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  async unarchive(cipher: C) {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }
    const activeUserId = await firstValueFrom(this.userId$);

    try {
      await this.cipherArchiveService.unarchiveWithServer(cipher.id as CipherId, activeUserId);

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemUnarchived"),
      });

      this.refresh();
    } catch (e) {
      this.logService.error("Error unarchiving cipher", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  async bulkUnarchive(ciphers: C[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const activeUserId = await firstValueFrom(this.userId$);
    const cipherIds = ciphers.map((c) => c.id as CipherId);
    try {
      await this.cipherArchiveService.unarchiveWithServer(cipherIds as CipherId[], activeUserId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("bulkUnarchiveItems"),
      });

      this.refresh();
    } catch (e) {
      this.logService.error("Error unarchiving ciphers", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  async applyOrganizationFilter(orgId: string) {
    if (orgId == null) {
      orgId = "MyVault";
    }
    const orgs = await firstValueFrom(this.filterComponent.filters.organizationFilter.data$);
    const orgNode = ServiceUtils.getTreeNodeObject(orgs, orgId) as TreeNode<OrganizationFilter>;
    await this.filterComponent.filters?.organizationFilter?.action(orgNode);
  }

  addFolder = (): void => {
    AddEditFolderDialogComponent.open(this.dialogService);
  };

  editFolder = async (folder: FolderFilter): Promise<void> => {
    const dialogRef = AddEditFolderDialogComponent.open(this.dialogService, {
      editFolderConfig: {
        // Shallow copy is used so the original folder object is not modified
        folder: {
          ...folder,
          name: folder.fullName ?? folder.name, // If the filter has a fullName populated, use that as the editable name
        },
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === AddEditFolderDialogResult.Deleted) {
      await this.router.navigate([], {
        queryParams: { folderId: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    }
  };

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  /**
   * Handles opening the attachments dialog for a cipher.
   * Runs several checks to ensure that the user has the correct permissions
   * and then opens the attachments dialog.
   * Uses the new AttachmentsV2Component
   * @param cipher
   * @returns
   */
  async editCipherAttachments(cipher: C) {
    if (cipher?.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      await this.go({ cipherId: null, itemId: null });
      return;
    }

    if (cipher.organizationId == null && !this.canAccessPremium) {
      await this.premiumUpgradePromptService.promptForPremium();
      return;
    } else if (cipher.organizationId != null) {
      const org = await firstValueFrom(
        this.organizations$.pipe(getOrganizationById(uuidAsString(cipher.organizationId))),
      );
      if (org != null && (org.maxStorageGb == null || org.maxStorageGb === 0)) {
        this.messagingService.send("upgradeOrganization", {
          organizationId: cipher.organizationId,
        });
        return;
      }
    }

    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
      organizationId: cipher.organizationId as OrganizationId,
    });

    const result: AttachmentDialogCloseResult = await lastValueFrom(dialogRef.closed);

    if (
      result.action === AttachmentDialogResult.Uploaded ||
      result.action === AttachmentDialogResult.Removed
    ) {
      this.refresh();
    }

    return;
  }

  /**
   * Open the combined view / edit dialog for a cipher.
   * @param mode - Starting mode of the dialog.
   * @param formConfig - Configuration for the form when editing/adding a cipher.
   * @param activeCollectionId - The active collection ID.
   */
  async openVaultItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
    activeCollectionId?: CollectionId,
  ) {
    this.vaultItemDialogRef = VaultItemDialogComponent.open(this.dialogService, {
      mode,
      formConfig,
      activeCollectionId,
      restore: this.restore,
    });

    const result = await lastValueFrom(this.vaultItemDialogRef.closed);
    this.vaultItemDialogRef = undefined;

    // When the dialog is closed for a premium upgrade, return early as the user
    // should be navigated to the subscription settings elsewhere
    if (result === VaultItemDialogResult.PremiumUpgrade) {
      return;
    }

    // If the dialog was closed by deleting the cipher, refresh the vault.
    if (result === VaultItemDialogResult.Deleted || result === VaultItemDialogResult.Saved) {
      this.refresh();
    }

    // Clear the query params when the dialog closes
    await this.go({ cipherId: null, itemId: null, action: null });
  }

  /**
   * Opens the add cipher dialog.
   * @param cipherType The type of cipher to add.
   */
  async addCipher(cipherType?: CipherType) {
    const type = cipherType ?? this.activeFilter.cipherType;
    const cipherFormConfig = await this.cipherFormConfigService.buildConfig("add", null, type);
    const collectionId =
      this.activeFilter.collectionId !== "AllCollections" && this.activeFilter.collectionId != null
        ? this.activeFilter.collectionId
        : null;
    let organizationId =
      this.activeFilter.organizationId !== "MyVault" && this.activeFilter.organizationId != null
        ? this.activeFilter.organizationId
        : null;
    // Attempt to get the organization ID from the collection if present
    if (collectionId) {
      const organizationIdFromCollection = (
        await firstValueFrom(this.vaultFilterService.filteredCollections$)
      ).find((c) => c.id === this.activeFilter.collectionId)?.organizationId;
      if (organizationIdFromCollection) {
        organizationId = organizationIdFromCollection;
      }
    }
    cipherFormConfig.initialValues = {
      organizationId: organizationId as OrganizationId,
      collectionIds: [collectionId as CollectionId],
      folderId: this.activeFilter.folderId,
    };

    await this.openVaultItemDialog("form", cipherFormConfig);
  }

  async editCipher(cipher: CipherView | CipherListView, cloneMode?: boolean) {
    return this.editCipherId(uuidAsString(cipher?.id), cloneMode);
  }

  /**
   * Edit a cipher using the new VaultItemDialog.
   * @param id
   * @param cloneMode
   * @returns
   */
  async editCipherId(id: string, cloneMode?: boolean) {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const cipher = await this.cipherService.get(id, activeUserId);

    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // didn't pass password prompt, so don't open add / edit modal
      await this.go({ cipherId: null, itemId: null, action: null });
      return;
    }

    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      cloneMode ? "clone" : "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openVaultItemDialog("form", cipherFormConfig);
  }

  /**
   * Takes a CipherView and opens a dialog where it can be viewed (wraps viewCipherById).
   * @param cipher - CipherView
   * @returns Promise<void>
   */
  viewCipher(cipher: CipherView) {
    return this.viewCipherById(cipher.id);
  }

  /**
   * Takes a cipher id and opens a dialog where it can be viewed.
   * @param id - string
   * @returns Promise<void>
   */
  async viewCipherById(id: string) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(id, activeUserId);
    // If cipher exists (cipher is null when new) and MP reprompt
    // is on for this cipher, then show password reprompt.
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
      cipher.edit ? "edit" : "partial-edit",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openVaultItemDialog(
      "view",
      cipherFormConfig,
      this.selectedCollection?.node.id as CollectionId,
    );
  }

  async addCollection() {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: this.allOrganizations
          .filter((o) => o.canCreateNewCollections && !o.isProviderUser)
          .sort(Utils.getSortFunction(this.i18nService, "name"))[0].id,
        parentCollectionId: this.filter.collectionId,
        showOrgSelector: true,
        limitNestedCollections: true,
      },
    });
    const result = await lastValueFrom(dialog.closed);
    if (result.action === CollectionDialogAction.Saved) {
      if (result.collection) {
        // Update CollectionService with the new collection
        const c = new CollectionData(result.collection as CollectionDetailsResponse);
        const activeUserId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(getUserId),
        );
        await this.collectionService.upsert(c, activeUserId);
      }
      this.refresh();
    }
  }

  async editCollection(c: CollectionView, tab: CollectionDialogTabType): Promise<void> {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        collectionId: c?.id,
        organizationId: c.organizationId,
        initialTab: tab,
        limitNestedCollections: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (result.action === CollectionDialogAction.Saved) {
      if (result.collection) {
        // Update CollectionService with the new collection
        const c = new CollectionData(result.collection as CollectionDetailsResponse);
        await this.collectionService.upsert(c, activeUserId);
      }
      this.refresh();
    } else if (result.action === CollectionDialogAction.Deleted) {
      const parent = this.selectedCollection?.parent;
      // Navigate away if we deleted the collection we were viewing
      const navigateAway = this.selectedCollection && this.selectedCollection.node.id === c.id;
      await this.collectionService.delete([result.collection?.id as CollectionId], activeUserId);
      this.refresh();
      if (navigateAway) {
        await this.router.navigate([], {
          queryParams: { collectionId: parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
    }
  }

  async deleteCollection(collection: CollectionView): Promise<void> {
    const organization = await firstValueFrom(
      this.organizations$.pipe(getOrganizationById(collection.organizationId)),
    );
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
      const parent = this.selectedCollection?.parent;
      // Navigate away if we deleted the collection we were viewing
      const navigateAway =
        this.selectedCollection && this.selectedCollection.node.id === collection.id;
      await this.apiService.deleteCollection(collection.organizationId, collection.id);
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.collectionService.delete([collection.id as CollectionId], activeUserId);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedCollectionId", collection.name),
      });
      if (navigateAway) {
        await this.router.navigate([], {
          queryParams: { collectionId: parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkAssignToCollections(ciphers: C[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    if (ciphers.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    let availableCollections: CollectionView[] = [];
    const orgId =
      this.activeFilter.organizationId ||
      ciphers.find((c) => c.organizationId !== null)?.organizationId;

    if (orgId && orgId !== "MyVault") {
      const organization = this.allOrganizations.find((o) => o.id === orgId);
      availableCollections = this.allCollections.filter(
        (c) => c.organizationId === organization.id,
      );
    }

    let ciphersToAssign: CipherView[];

    // Convert `CipherListView` to `CipherView` if necessary
    if (ciphers.some(CipherViewLikeUtils.isCipherListView)) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      ciphersToAssign = await firstValueFrom(
        this.cipherService
          .cipherViews$(userId)
          .pipe(
            map(
              (cipherViews) =>
                cipherViews.filter((c) => ciphers.some((cc) => cc.id === c.id)) as CipherView[],
            ),
          ),
      );
    } else {
      ciphersToAssign = ciphers as CipherView[];
    }

    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers: ciphersToAssign,
        organizationId: orgId as OrganizationId,
        availableCollections,
        activeCollection: this.activeFilter?.selectedCollectionNode?.node,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionAssignmentResult.Saved) {
      this.refresh();
    }
  }

  async cloneCipher(cipher: CipherView | CipherListView) {
    if (CipherViewLikeUtils.hasFido2Credentials(cipher)) {
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

  restore = async (c: C): Promise<boolean> => {
    if (!CipherViewLikeUtils.isDeleted(c)) {
      return;
    }

    if (!c.edit) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher([c]))) {
      return;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.restoreWithServer(uuidAsString(c.id), activeUserId);
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

  async bulkRestore(ciphers: C[]) {
    if (ciphers.some((c) => !c.edit)) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const selectedCipherIds = ciphers.map((cipher) => uuidAsString(cipher.id));
    if (selectedCipherIds.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreManyWithServer(selectedCipherIds, activeUserId);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("restoredItems"),
    });
    this.refresh();
  }

  private async handleDeleteEvent(items: VaultItem<C>[]) {
    const ciphers: C[] = items.filter((i) => i.collection === undefined).map((i) => i.cipher);
    const collections = items.filter((i) => i.cipher === undefined).map((i) => i.collection);
    if (ciphers.length === 1 && collections.length === 0) {
      await this.deleteCipher(ciphers[0]);
    } else if (ciphers.length === 0 && collections.length === 1) {
      await this.deleteCollection(collections[0]);
    } else {
      const orgIds = items
        .filter((i) => i.cipher === undefined)
        .map((i) => i.collection.organizationId);
      const orgs = await firstValueFrom(
        this.organizations$.pipe(map((orgs) => orgs.filter((o) => orgIds.includes(o.id)))),
      );
      await this.bulkDelete(ciphers, collections, orgs);
    }
  }

  async deleteCipher(c: C): Promise<boolean> {
    if (!(await this.repromptCipher([c]))) {
      return;
    }

    if (!c.edit) {
      this.showMissingPermissionsError();
      return;
    }

    const permanent = CipherViewLikeUtils.isDeleted(c);

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
      await this.deleteCipherWithServer(uuidAsString(c.id), activeUserId, permanent);

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

  async bulkDelete(ciphers: C[], collections: CollectionView[], organizations: Organization[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    if (ciphers.length === 0 && collections.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const canDeleteCollections =
      collections == null ||
      collections.every((c) => c.canDelete(organizations.find((o) => o.id == c.organizationId)));
    const canDeleteCiphers = ciphers == null || ciphers.every((c) => c.edit);

    if (!canDeleteCollections || !canDeleteCiphers) {
      this.showMissingPermissionsError();
      return;
    }

    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: {
        permanent: this.filter.type === "trash",
        cipherIds: ciphers.map((c) => uuidAsString(c.id)),
        organizations: organizations,
        collections: collections,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkDeleteDialogResult.Deleted) {
      this.refresh();
    }
  }

  async bulkMove(ciphers: C[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const selectedCipherIds = ciphers.map((cipher) => uuidAsString(cipher.id));
    if (selectedCipherIds.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const dialog = openBulkMoveDialog(this.dialogService, {
      data: { cipherIds: selectedCipherIds },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkMoveDialogResult.Moved) {
      this.refresh();
    }
  }

  async copy(cipher: C, field: "username" | "password" | "totp") {
    let aType;
    let value;
    let typeI18nKey;

    const login = CipherViewLikeUtils.getLogin(cipher);

    if (!login) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("unexpectedError"),
      });
    }

    if (field === "username") {
      aType = "Username";
      value = login.username;
      typeI18nKey = "username";
    } else if (field === "password") {
      aType = "Password";
      value = await this.getPasswordFromCipherViewLike(cipher);
      typeI18nKey = "password";
    } else if (field === "totp") {
      aType = "TOTP";
      const totpResponse = await firstValueFrom(this.totpService.getCode$(login.totp));
      value = totpResponse.code;
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
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientCopiedPassword,
        uuidAsString(cipher.id),
      );
    } else if (field === "totp") {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientCopiedHiddenField,
        uuidAsString(cipher.id),
      );
    }
  }

  /**
   * Toggles the favorite status of the cipher and updates it on the server.
   */
  async handleFavoriteEvent(cipher: C) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherFullView = await this.cipherService.getFullCipherView(cipher);
    cipherFullView.favorite = !cipherFullView.favorite;
    const encryptedCipher = await this.cipherService.encrypt(cipherFullView, activeUserId);
    await this.cipherService.updateWithServer(encryptedCipher);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        cipherFullView.favorite ? "itemAddedToFavorites" : "itemRemovedFromFavorites",
      ),
    });

    this.refresh();
  }

  protected deleteCipherWithServer(id: string, userId: UserId, permanent: boolean) {
    return permanent
      ? this.cipherService.deleteWithServer(id, userId)
      : this.cipherService.softDeleteWithServer(id, userId);
  }

  protected async repromptCipher(ciphers: C[]) {
    const notProtected = !ciphers.find((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  private refresh() {
    this.refresh$.next();
    this.vaultItemsComponent?.clearSelection();
  }

  private async go(queryParams: any = null) {
    if (queryParams == null) {
      queryParams = {
        favorites: this.activeFilter.isFavorites || null,
        type: this.activeFilter.cipherType,
        folderId: this.activeFilter.folderId,
        collectionId: this.activeFilter.collectionId,
        deleted: this.activeFilter.isDeleted || null,
      };
    }

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  private showMissingPermissionsError() {
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t("missingPermissions"),
    });
  }

  /**
   * Returns the password for a `CipherViewLike` object.
   * `CipherListView` does not contain the password, the full `CipherView` needs to be fetched.
   */
  private async getPasswordFromCipherViewLike(cipher: C): Promise<string | undefined> {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      return Promise.resolve(cipher.login?.password);
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const _cipher = await this.cipherService.get(uuidAsString(cipher.id), activeUserId);
    const cipherView = await this.cipherService.decrypt(_cipher, activeUserId);
    return cipherView.login?.password;
  }
}

/**
 * Allows backwards compatibility with
 * old links that used the original `cipherId` param
 */
const getCipherIdFromParams = (params: Params): string => {
  return params["itemId"] || params["cipherId"];
};
