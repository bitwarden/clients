// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  firstValueFrom,
  Subject,
  takeUntil,
  switchMap,
  lastValueFrom,
  Observable,
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  of,
} from "rxjs";
import { filter, map, shareReplay, concatMap, tap } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import {
  NoResults,
  DeactivatedOrg,
  EmptyTrash,
  FavoritesIcon,
  ItemTypes,
  BitSvg,
} from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView, Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  getNestedCollectionTree,
  getFlatCollectionTree,
} from "@bitwarden/common/admin-console/utils";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, OrganizationId, UserId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType, toCipherType } from "@bitwarden/common/vault/enums";
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
import {
  DialogRef,
  DialogService,
  ToastService,
  SearchModule,
  AutofocusDirective,
} from "@bitwarden/components";
import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogResult,
  AddItemDialogCloseResult,
  AddItemDialogComponent,
  AddItemDialogResult,
  CipherActionService,
  CipherFormConfig,
  CipherFormConfigService,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  DefaultCipherFormConfigService,
  DefaultVaultItemsTransferService,
  PasswordRepromptService,
  VaultFilter,
  VaultFilterServiceAbstraction as VaultFilterService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
  createFilterFunction,
  All,
  VaultItemsTransferService,
  NewCipherMenuComponent,
  ASSIGN_COLLECTIONS_DIALOG,
  BULK_DELETE_DIALOG,
  VaultBatchActionComponent,
  VaultBatchBarService,
  VaultOrganizationUserNotificationsComponent,
  Vfo1TerminologyService,
  ALL_ITEMS_SCOPE,
  cipherInScope,
  collectionInScope,
  FilterFunction,
  organizationInScope,
  resolveVaultScope,
  VaultNavService,
  VaultScopeType,
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header/desktop-header.component";
import { ImportDesktopComponent } from "../../../app/tools/import/import-desktop.component";
import { AssignCollectionsDesktopComponent } from "../vault/assign-collections";

import { AssignCollectionsDesktopDialogAdapter } from "./bulk-action-dialogs/assign-collections-desktop-dialog.adapter";
import { BulkDeleteDialogDesktopAdapter } from "./bulk-action-dialogs/bulk-delete-dialog-desktop.adapter";
import { VaultItemEvent } from "./vault-items/vault-item-event";
import { VaultListTableComponent } from "./vault-list-table/vault-list-table.component";
import { VaultListComponent } from "./vault-list.component";

const BroadcasterSubscriptionId = "VaultComponent";

type EmptyStateType = "trash" | "favorites" | "archive";

type EmptyStateItem = {
  title: string;
  description: string;
  icon: BitSvg;
};

type EmptyStateMap = Record<EmptyStateType, EmptyStateItem>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-v3",
  templateUrl: "vault.component.html",
  imports: [
    CommonModule,
    VaultListComponent,
    VaultListTableComponent,
    DesktopHeaderComponent,
    NewCipherMenuComponent,
    SearchModule,
    FormsModule,
    VaultBatchActionComponent,
    VaultOrganizationUserNotificationsComponent,
    AutofocusDirective,
  ],
  providers: [
    { provide: VaultItemsTransferService, useClass: DefaultVaultItemsTransferService },
    { provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService },
    VaultBatchBarService,
    { provide: ASSIGN_COLLECTIONS_DIALOG, useClass: AssignCollectionsDesktopDialogAdapter },
    { provide: BULK_DELETE_DIALOG, useClass: BulkDeleteDialogDesktopAdapter },
  ],
})
export class VaultComponent<C extends CipherViewLike> implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18nService = inject(I18nService);
  private broadcasterService = inject(BroadcasterService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private messagingService = inject(MessagingService);
  private syncService = inject(SyncService);
  private configService = inject(ConfigService);
  private eventCollectionService = inject(EventCollectionService);
  private searchService = inject(SearchService);
  private searchPipe = inject(SearchPipe);
  private passwordRepromptService = inject(PasswordRepromptService);
  private dialogService = inject(DialogService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private toastService = inject(ToastService);
  private accountService = inject(AccountService);
  private cipherService = inject(CipherService);
  private premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private collectionService = inject(CollectionService);
  private organizationService = inject(OrganizationService);
  private restrictedItemTypesService = inject(RestrictedItemTypesService);
  private cipherArchiveService = inject(CipherArchiveService);
  private policyService = inject(PolicyService);
  private cipherActionService = inject(CipherActionService);
  private routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private vaultFilterService = inject(VaultFilterService);
  private routedVaultFilterService = inject(RoutedVaultFilterService);
  private vaultItemTransferService: VaultItemsTransferService = inject(VaultItemsTransferService);
  private platformUtilsService = inject(PlatformUtilsService);
  private totpService = inject(TotpService);
  private vfo1TerminologyService = inject(Vfo1TerminologyService);
  private folderService = inject(FolderService);
  private vaultNavService = inject(VaultNavService);

  private destroyRef = inject(DestroyRef);
  private cipherFormConfigService = inject(CipherFormConfigService);
  private vaultBatchBarService = inject(VaultBatchBarService, { optional: true });
  private activeDrawerRef?: DialogRef<VaultItemDialogResult>;

  protected readonly activeFilter = signal<VaultFilter>(new VaultFilter());
  protected cipherRepromptId: string | null = null;
  protected showingModal = false;

  protected readonly cipher = signal<CipherView | null>(null);

  private activeUserId: UserId | null = null;
  private userId$ = this.accountService.activeAccount$.pipe(getUserId);
  showPremiumCallout$: Observable<boolean> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.routedVaultFilterBridgeService.activeFilter$,
        this.cipherArchiveService.showSubscriptionEndedMessaging$(userId),
      ]).pipe(map(([activeFilter, showMessaging]) => activeFilter.isArchived && showMessaging)),
    ),
  );

  readonly userHasPremium = toSignal(
    this.accountService.activeAccount$.pipe(
      filter((account): account is Account => !!account),
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      ),
    ),
    { initialValue: false },
  );

  protected readonly vaultBatchBarFeatureFlag = toSignal(
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM37785_VaultBatchBar),
      this.configService.getFeatureFlag$(FeatureFlag.PM37785_DesktopVaultBatchBar),
    ]).pipe(map(([batchBarFlag, desktopBatchBarFlag]) => batchBarFlag && desktopBatchBarFlag)),
    { initialValue: false },
  );

  protected readonly folders = toSignal(
    this.accountService.activeAccount$.pipe(
      map((a) => a?.id),
      filterOutNullish(),
      switchMap((userId) => this.folderService.folderViews$(userId)),
      // Filter out "No folder" option, the table provides it by default.
      map((folders) => folders.filter((f) => f.id)),
    ),
    { initialValue: [] },
  );

  private readonly vfo1Foundation$ = this.configService
    .getFeatureFlag$(FeatureFlag.VFO1Foundation)
    .pipe(shareReplay({ refCount: true, bufferSize: 1 }));

  protected readonly vfo1Foundation = toSignal(this.vfo1Foundation$, { initialValue: false });

  private organizations$: Observable<Organization[]> = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filterOutNullish(),
    switchMap((id) => this.organizationService.organizations$(id)),
  );

  /** The vault the `:vaultId` segment scopes this page to; always All items on the legacy nav. */
  private readonly vaultScope$ = this.vfo1Foundation$.pipe(
    switchMap((vfo1Foundation) =>
      vfo1Foundation
        ? combineLatest([
            this.route.paramMap.pipe(map((params) => params.get("vaultId"))),
            this.userId$.pipe(switchMap((userId) => this.vaultNavService.viewModel$(userId))),
          ]).pipe(
            // Desktop has no route for drilling into a shared folder, so it names no collection.
            map(([vaultId, nav]) => resolveVaultScope(vaultId, null, nav) ?? ALL_ITEMS_SCOPE),
          )
        : of(ALL_ITEMS_SCOPE),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** The organization the page is pinned to, whichever nav the user is on. */
  private readonly selectedOrganization$ = combineLatest([
    this.vfo1Foundation$,
    this.vaultScope$,
    this.routedVaultFilterService.filter$,
    this.organizations$,
  ]).pipe(
    map(([vfo1Foundation, scope, filter, organizations]) => {
      const organizationId =
        vfo1Foundation && scope.type === VaultScopeType.Organization
          ? scope.organizationId
          : filter?.organizationId;
      return organizations?.find((org) => org.id === organizationId);
    }),
  );

  protected readonly showAddCipherBtn$ = combineLatest([
    this.vfo1Foundation$,
    this.vaultScope$,
    this.routedVaultFilterService.filter$,
    this.selectedOrganization$,
  ]).pipe(
    map(([vfo1Foundation, scope, filter, selectedOrganization]) => {
      if (selectedOrganization && !selectedOrganization.enabled) {
        return false;
      }

      if (vfo1Foundation) {
        return scope.type !== VaultScopeType.Trash && scope.type !== VaultScopeType.Archive;
      }

      const emptyStateTypes: EmptyStateType[] = ["trash", "favorites", "archive"];
      return !(filter?.type && emptyStateTypes.includes(filter.type as EmptyStateType));
    }),
  );

  /**
   * Whether a new cipher can be created in the currently selected organization.
   * `false` when the target organization is suspended, since items cannot be saved to it.
   */
  protected readonly canCreateCipher$ = this.selectedOrganization$.pipe(
    map((selectedOrganization) => !selectedOrganization || selectedOrganization.enabled),
  );

  protected deactivatedOrgIcon = DeactivatedOrg;
  protected emptyTrashIcon = EmptyTrash;
  protected favoritesIcon = FavoritesIcon;
  protected itemTypesIcon = ItemTypes;
  protected noResultsIcon = NoResults;
  protected performingInitialLoad = true;
  protected refreshing = false;
  protected allOrganizations: Organization[] = [];
  protected allCollections: CollectionView[] = [];
  protected scopedOrganizations: Organization[] = [];
  protected scopedCollections: CollectionView[] = [];
  protected collectionsToDisplay: CollectionView[] = [];

  protected readonly searchPlaceholderText = computed(() =>
    this.i18nService.t(this.calculateSearchBarLocalizationString(this.activeFilter())),
  );
  protected ciphers: C[] = [];
  protected isEmpty: boolean;
  protected currentSearchText$: Observable<string> = this.route.queryParams.pipe(
    map((queryParams) => queryParams.search),
  );
  private searchText$ = new Subject<string>();
  private refresh$ = new BehaviorSubject<void>(null);
  private destroy$ = new Subject<void>();

  protected userCanArchive$ = this.userId$.pipe(
    switchMap((userId) => {
      return this.cipherArchiveService.userCanArchive$(userId);
    }),
  );

  protected enforceOrgDataOwnershipPolicy$ = this.userId$.pipe(
    switchMap((userId) =>
      this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
    ),
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
        return emptyStateMap[filter.type as EmptyStateType];
      }

      return {
        title: "noItemsInVault",
        description: "emptyVaultDescription",
        icon: this.itemTypesIcon,
      };
    }),
  );

  async ngOnInit() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.activeUserId = activeUserId;

    // Clear cipher selection on page load/reload to prevent flash of content
    const currentParams = await firstValueFrom(this.route.queryParams);

    const incomingAddType = toCipherType(currentParams.addType);
    if (currentParams.action === "add" && incomingAddType) {
      await this.addCipher(incomingAddType).catch(() => {});
    }

    // Clear cipher selection on page load/reload to prevent flash of content
    if (currentParams.itemId || currentParams.cipherId) {
      await this.router.navigate([], {
        queryParams: { itemId: null, cipherId: null, action: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    }

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      void this.ngZone.run(async () => {
        let detectChanges = true;
        try {
          switch (message.command) {
            case "newLogin":
              await this.addCipher(CipherType.Login);
              break;
            case "newCard":
              await this.addCipher(CipherType.Card);
              break;
            case "newIdentity":
              await this.addCipher(CipherType.Identity);
              break;
            case "newSecureNote":
              await this.addCipher(CipherType.SecureNote);
              break;
            case "newSshKey":
              await this.addCipher(CipherType.SshKey);
              break;
            case "focusSearch":
              (document.querySelector("bit-search input") as HTMLInputElement)?.select();
              detectChanges = false;
              break;
            case "syncCompleted":
              if (message.successfully) {
                if (this.activeUserId) {
                  void this.vaultItemTransferService.enforceOrganizationDataOwnership(
                    this.activeUserId,
                  );
                }
                this.refresh();
              }
              break;
            case "modalShown":
              this.showingModal = true;
              break;
            case "modalClosed":
              this.showingModal = false;
              break;
            case "copyUsername": {
              const cipher = this.cipher();
              if (cipher?.login?.username) {
                this.copyValue(cipher, cipher.login.username, "username", "Username");
              }
              break;
            }
            case "copyPassword": {
              const cipher = this.cipher();
              if (cipher?.login?.password && cipher.viewPassword) {
                this.copyValue(cipher, cipher.login.password, "password", "Password");
                await this.eventCollectionService.collect(
                  EventType.Cipher_ClientCopiedPassword,
                  cipher.id,
                );
              }
              break;
            }
            case "copyTotp": {
              const cipher = this.cipher();
              if (cipher?.login?.hasTotp && (cipher.organizationUseTotp || this.userHasPremium())) {
                const value = await firstValueFrom(
                  this.totpService.getCode$(cipher.login.totp),
                ).catch((): any => null);
                if (value) {
                  this.copyValue(cipher, value.code, "verificationCodeTotp", "TOTP");
                }
              }
              break;
            }
            default:
              detectChanges = false;
              break;
          }
        } catch {
          // Ignore errors
        }
        if (detectChanges) {
          this.changeDetectorRef.detectChanges();
        }
      });
    });

    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeFilter) => {
        this.activeFilter.set(activeFilter);
      });

    const filter$ = this.routedVaultFilterService.filter$;

    /** Rows come from the route's scope under VFO1, and from the query-param filter otherwise. */
    const rowFilter$ = combineLatest([this.vfo1Foundation$, this.vaultScope$, filter$]).pipe(
      map(([vfo1Foundation, scope, filter]): FilterFunction =>
        vfo1Foundation ? (cipher) => cipherInScope(cipher, scope) : createFilterFunction(filter),
      ),
    );

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
          state: {
            focusMainAfterNav: false,
          },
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

    const ciphers$ = combineLatest([allowedCiphers$, rowFilter$, this.currentSearchText$]).pipe(
      filter(([ciphers, filterFunction]) => ciphers != undefined && filterFunction != undefined),
      concatMap(async ([ciphers, filterFunction, searchText]) => {
        const failedCiphers =
          (await firstValueFrom(this.cipherService.failedToDecryptCiphers$(activeUserId))) ?? [];
        // Append any failed to decrypt ciphers to the top of the cipher list
        const allCiphers = [...failedCiphers, ...ciphers];

        if (await this.searchService.isSearchable(searchText)) {
          const result = await this.searchService.searchCiphers<C>(
            activeUserId,
            null,
            searchText,
            allCiphers as C[],
          );
          return result.filter(filterFunction);
        }

        return allCiphers.filter(filterFunction) as C[];
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

        if (await this.searchService.isSearchable(searchText)) {
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

    this.refresh$
      .pipe(
        tap(() => (this.refreshing = true)),
        switchMap(() =>
          combineLatest([
            allCollections$,
            this.organizations$,
            ciphers$,
            collections$,
            this.vfo1Foundation$,
            this.vaultScope$,
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(
        ([allCollections, allOrganizations, ciphers, collections, vfo1Foundation, scope]) => {
          this.allCollections = allCollections;
          this.allOrganizations = allOrganizations;
          this.scopedCollections = vfo1Foundation
            ? allCollections.filter((collection) => collectionInScope(collection, scope))
            : allCollections;
          this.scopedOrganizations = vfo1Foundation
            ? allOrganizations.filter((organization) => organizationInScope(organization, scope))
            : allOrganizations;
          this.ciphers = ciphers;
          this.collectionsToDisplay = collections;
          this.isEmpty = collections?.length === 0 && ciphers?.length === 0;
          this.performingInitialLoad = false;
          this.refreshing = false;

          // Explicitly mark for check to ensure the view is updated
          // Some sources are not always emitted within the Angular zone (e.g. ciphers updated via WS server notifications)
          this.changeDetectorRef.markForCheck();
        },
      );

    combineLatest([allCollections$, ciphers$.pipe(map((c) => c.length > 0))])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([allCollections, hasCiphers]) =>
        this.vaultBatchBarService?.setConfig({ isOrgVault: false, allCollections, hasCiphers }),
      );

    this.vaultBatchBarService?.completed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refresh());

    this.cipherActionService.cipherModified$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refresh());

    void this.vaultItemTransferService.enforceOrganizationDataOwnership(this.activeUserId);
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
    this.vaultFilterService.clearOrganizationFilter();
    void this.activeDrawerRef?.close();
  }

  async onVaultItemsEvent(event: VaultItemEvent<C>) {
    switch (event.type) {
      case "viewCipher":
        await this.viewCipher(event.item);
        break;
      case "viewAttachments":
        await this.cipherActionService.viewAttachments(event.item);
        break;
      case "restore":
        await this.cipherActionService.restore(event.items[0]);
        break;
      case "delete":
        if (event.items[0].cipher) {
          await this.cipherActionService.delete(event.items[0].cipher);
        }
        break;
      case "archive":
        await this.cipherActionService.archive(event.items[0]);
        break;
      case "unarchive":
        await this.cipherActionService.unarchive(event.items[0]);
        break;
      case "toggleFavorite":
        await this.cipherActionService.toggleFavorite(event.item);
        break;
      case "clone": {
        const cipher = await this.cipherService.getFullCipherView(event.item);
        await this.cloneCipher(cipher);
        break;
      }
      case "assignToCollections":
        if (event.items.length === 1) {
          const cipher = await this.cipherService.getFullCipherView(event.items[0]);
          await this.shareCipher(cipher);
        }
        break;
      case "editCipher": {
        const fullCipher = await this.cipherService.getFullCipherView(event.item);
        await this.editCipher(fullCipher);
        break;
      }
    }
  }

  async viewCipher(c: CipherViewLike) {
    if (CipherViewLikeUtils.decryptionFailure(c)) {
      DecryptionFailureDialogComponent.open(this.dialogService, {
        cipherIds: [c.id as CipherId],
      });
      return;
    }
    const cipher = await this.cipherService.getFullCipherView(c);
    if (await this.shouldReprompt(cipher)) {
      return;
    }
    const formConfig = await this.cipherFormConfigService.buildConfig(
      cipher.edit ? "edit" : "partial-edit",
      cipher.id as CipherId,
      cipher.type,
    );
    if (await this.openDialog("view", formConfig)) {
      this.cipher.set(cipher);
    }
  }

  async shouldReprompt(cipher: CipherView): Promise<boolean> {
    return !(await this.passwordReprompt(cipher));
  }

  async editCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher)) {
      return;
    }
    const formConfig = await this.cipherFormConfigService.buildConfig(
      cipher.edit ? "edit" : "partial-edit",
      cipher.id as CipherId,
      cipher.type,
    );
    if (await this.openDialog("form", formConfig)) {
      this.cipher.set(cipher);
    }
  }

  async cloneCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher)) {
      return;
    }
    const formConfig = await this.cipherFormConfigService.buildConfig(
      "clone",
      cipher.id as CipherId,
      cipher.type,
    );
    if (await this.openDialog("form", formConfig)) {
      this.cipher.set(cipher);
    }
  }

  async shareCipher(cipher: CipherView) {
    if (!cipher) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    if (!(await this.passwordReprompt(cipher))) {
      return;
    }

    const availableCollections = this.getAvailableCollections(cipher);

    const dialog = AssignCollectionsDesktopComponent.open(this.dialogService, {
      data: {
        ciphers: [cipher],
        organizationId: cipher.organizationId as OrganizationId,
        availableCollections,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionAssignmentResult.Saved) {
      this.refresh();
    }
  }

  async addCipher(type?: CipherType) {
    const activeFilter = this.activeFilter();
    const cipherType = type ?? activeFilter.cipherType;

    let organizationId: OrganizationId | null = null;
    let collectionIds: CollectionId[] = [];
    let folderId: string | undefined;

    if (activeFilter.collectionId != null) {
      const collection = this.allCollections.find((c) => c.id === activeFilter.collectionId);
      if (collection) {
        organizationId = collection.organizationId as OrganizationId;
        collectionIds = [activeFilter.collectionId as CollectionId];
      }
    } else if (activeFilter.organizationId && activeFilter.organizationId !== "MyVault") {
      organizationId = activeFilter.organizationId as OrganizationId;
    }

    if (activeFilter.folderId && activeFilter.selectedFolderNode) {
      folderId = activeFilter.folderId;
    }

    const organization = organizationId
      ? this.allOrganizations?.find((o) => o.id === organizationId)
      : undefined;
    if (organization && !organization.enabled) {
      // The organization is suspended and cannot have new items saved to it.
      return;
    }

    const formConfig = await this.cipherFormConfigService.buildConfig("add", undefined, cipherType);
    formConfig.initialValues = {
      folderId,
      organizationId: organizationId ?? undefined,
      collectionIds,
    };
    await this.openDialog("form", formConfig);

    if (type === CipherType.SshKey) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("sshKeyGenerated"),
      });
    }
  }

  restore = async (c: CipherViewLike) => {
    await this.cipherActionService.restore(c);
  };

  private getAvailableCollections(cipher: CipherView): CollectionView[] {
    const orgId = cipher.organizationId;
    if (!orgId || orgId === "MyVault") {
      return [];
    }

    const organization = this.allOrganizations.find((o) => o.id === orgId);
    return this.allCollections.filter((c) => c.organizationId === organization?.id && !c.readOnly);
  }

  private calculateSearchBarLocalizationString(vaultFilter: VaultFilter): string {
    if (vaultFilter.isFavorites) {
      return "searchFavorites";
    }
    if (vaultFilter.isArchived) {
      return "searchArchive";
    }
    if (vaultFilter.isDeleted) {
      return "searchTrash";
    }
    if (vaultFilter.cipherType != null) {
      if (vaultFilter.cipherType === CipherType.Login) {
        return "searchLogin";
      }
      if (vaultFilter.cipherType === CipherType.Card) {
        return "searchCard";
      }
      if (vaultFilter.cipherType === CipherType.Identity) {
        return "searchIdentity";
      }
      if (vaultFilter.cipherType === CipherType.SecureNote) {
        return "searchSecureNote";
      }
      if (vaultFilter.cipherType === CipherType.SshKey) {
        return "searchSshKey";
      }
      if (vaultFilter.cipherType === CipherType.Passport) {
        return "searchPassport";
      }
      if (vaultFilter.cipherType === CipherType.BankAccount) {
        return "searchBankAccount";
      }
      return "searchType";
    }
    if (vaultFilter.folderId != null && vaultFilter.folderId !== "none") {
      return this.vfo1TerminologyService.enabled() ? "searchMyFolder" : "searchFolder";
    }
    if (vaultFilter.collectionId != null) {
      return this.vfo1TerminologyService.enabled() ? "searchSharedFolder" : "searchCollection";
    }
    if (vaultFilter.organizationId != null) {
      if (vaultFilter.isMyVaultSelected) {
        return "searchMyVault";
      } else {
        return "searchOrganization";
      }
    }
    if (vaultFilter.isMyVaultSelected) {
      return "searchMyVault";
    }
    return "searchVault";
  }

  async addFolder() {
    if (await this.configService.getFeatureFlag(FeatureFlag.PM32009NewItemTypes)) {
      const folderRef = AddEditFolderDialogComponent.open(this.dialogService);
      const folderResult = await firstValueFrom(folderRef.closed);
      if (folderResult === AddEditFolderDialogResult.Created) {
        await this.syncService.fullSync(false);
      }
    } else {
      this.messagingService.send("newFolder");
    }
  }

  protected async openAddItemDialog(): Promise<void> {
    const canCreateCipher = await firstValueFrom(this.canCreateCipher$);
    const ref = AddItemDialogComponent.open(this.dialogService, {
      canCreateCipher,
      canCreateFolder: true,
      canCreateCollection: false,
      canCreateSshKey: true,
    });

    const result: AddItemDialogCloseResult | undefined = await firstValueFrom(ref.closed);
    if (result == null) {
      return;
    }

    if (result.result === AddItemDialogResult.Cipher) {
      await this.addCipher(result.cipherType);
    } else if (result.result === AddItemDialogResult.Folder) {
      await this.addFolder();
    }
  }

  protected openImport(): void {
    this.dialogService.open(ImportDesktopComponent);
  }

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  /** Trigger a refresh of the vault data */
  private refresh() {
    this.refresh$.next();
  }

  private dirtyInput(): boolean {
    return document.querySelectorAll("vault-cipher-form .ng-dirty").length > 0;
  }

  private async wantsToSaveChanges(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "unsavedChangesTitle" },
      content: { key: "unsavedChangesConfirmation" },
      type: "warning",
    });
    return !confirmed;
  }

  private async openDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
  ): Promise<boolean> {
    if (this.activeDrawerRef != null && this.dirtyInput()) {
      const keepChanges = await this.wantsToSaveChanges();
      if (keepChanges) {
        return false;
      }
      await this.activeDrawerRef.close();
    }
    const drawerRef = await VaultItemDialogComponent.openDrawer(this.dialogService, {
      mode,
      formConfig,
      restore: this.restore,
    });
    this.activeDrawerRef = drawerRef;
    drawerRef?.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      // Opening a new drawer closes the previous one, which emits `closed` after the new
      // drawer is already active. Only clear state if this drawer is still the active one,
      // so switching items doesn't wipe the newly-selected cipher used by copy shortcuts.
      if (this.activeDrawerRef === drawerRef) {
        this.activeDrawerRef = undefined;
        this.cipher.set(null);
      }
      void this.router.navigate([], {
        queryParams: { action: null, itemId: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
      if (result === VaultItemDialogResult.Saved || result === VaultItemDialogResult.Deleted) {
        this.refresh();
      }
    });
    return drawerRef != null;
  }

  private copyValue(cipher: CipherView, value: string, labelI18nKey: string, aType: string) {
    this.functionWithChangeDetection(() => {
      (async () => {
        if (
          cipher.reprompt !== CipherRepromptType.None &&
          this.passwordRepromptService.protectedFields().includes(aType) &&
          !(await this.passwordReprompt(cipher))
        ) {
          return;
        }
        this.platformUtilsService.copyToClipboard(value);
        this.toastService.showToast({
          variant: "info",
          title: undefined,
          message: this.i18nService.t("valueCopied", this.i18nService.t(labelI18nKey)),
        });
        this.messagingService.send("minimizeOnCopy");
      })().catch(() => {});
    });
  }

  private functionWithChangeDetection(func: () => void) {
    this.ngZone.run(() => {
      func();
      this.changeDetectorRef.detectChanges();
    });
  }

  /** Prompts the user for their master password if the cipher has reprompt enabled. */
  private async passwordReprompt(cipher: CipherView) {
    if (cipher.reprompt === CipherRepromptType.None) {
      this.cipherRepromptId = null;
      return true;
    }
    if (this.cipherRepromptId === cipher.id) {
      return true;
    }
    const repromptResult = await this.passwordRepromptService.showPasswordPrompt();
    if (repromptResult) {
      this.cipherRepromptId = cipher.id;
    }
    return repromptResult;
  }
}
