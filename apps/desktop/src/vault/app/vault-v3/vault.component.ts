// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, Params } from "@angular/router";
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
} from "rxjs";
import { filter, map, take, first, shareReplay, concatMap, tap } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import {
  NoResults,
  DeactivatedOrg,
  EmptyTrash,
  FavoritesIcon,
  ItemTypes,
  Icon,
} from "@bitwarden/assets/svg";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
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
import { EventType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, OrganizationId, UserId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
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
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  ItemModule,
  ToastService,
  CopyClickListener,
  COPY_CLICK_LISTENER,
  IconButtonModule,
  NoItemsModule,
  SearchModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  ChangeLoginPasswordService,
  CipherFormConfigService,
  CipherFormGenerationService,
  CipherFormModule,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  DefaultChangeLoginPasswordService,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  ArchiveCipherUtilitiesService,
  VaultFilter,
  VaultFilterServiceAbstraction as VaultFilterService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  RoutedVaultFilterModel,
  createFilterFunction,
  All,
  VaultItem,
  VaultItemEvent,
  VaultItemsTransferService,
  DefaultVaultItemsTransferService,
  NewCipherMenuComponent,
  VaultItemDrawerComponent,
  VaultItemDrawerParams,
  VaultItemDrawerResult,
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header/desktop-header.component";
import { SearchBarService } from "../../../app/layout/search/search-bar.service";
import { DesktopCredentialGenerationService } from "../../../services/desktop-cipher-form-generator.service";
import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { AssignCollectionsDesktopComponent } from "../vault/assign-collections";

import { VaultListComponent } from "./vault-list.component";

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
  selector: "app-vault-v3",
  templateUrl: "vault.component.html",
  imports: [
    BadgeModule,
    CommonModule,
    CipherFormModule,
    I18nPipe,
    ItemModule,
    ButtonModule,
    IconButtonModule,
    NoItemsModule,
    VaultListComponent,
    DesktopHeaderComponent,
    NewCipherMenuComponent,
    SearchModule,
    FormsModule,
  ],
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: DefaultCipherFormConfigService,
    },
    {
      provide: ChangeLoginPasswordService,
      useClass: DefaultChangeLoginPasswordService,
    },
    {
      provide: ViewPasswordHistoryService,
      useClass: VaultViewPasswordHistoryService,
    },
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
    { provide: CipherFormGenerationService, useClass: DesktopCredentialGenerationService },
    {
      provide: COPY_CLICK_LISTENER,
      useExisting: VaultComponent,
    },
    { provide: VaultItemsTransferService, useClass: DefaultVaultItemsTransferService },
  ],
})
export class VaultComponent<C extends CipherViewLike>
  implements OnInit, OnDestroy, CopyClickListener
{
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18nService = inject(I18nService);
  private broadcasterService = inject(BroadcasterService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private syncService = inject(SyncService);
  private messagingService = inject(MessagingService);
  private platformUtilsService = inject(PlatformUtilsService);
  private eventCollectionService = inject(EventCollectionService);
  private searchService = inject(SearchService);
  private searchPipe = inject(SearchPipe);
  private totpService = inject(TotpService);
  private passwordRepromptService = inject(PasswordRepromptService);
  private dialogService = inject(DialogService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private toastService = inject(ToastService);
  private accountService = inject(AccountService);
  private cipherService = inject(CipherService);
  private formConfigService = inject(CipherFormConfigService);
  private premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private collectionService = inject(CollectionService);
  private logService = inject(LogService);
  private organizationService = inject(OrganizationService);
  private folderService = inject(FolderService);
  private restrictedItemTypesService = inject(RestrictedItemTypesService);
  private cipherArchiveService = inject(CipherArchiveService);
  private policyService = inject(PolicyService);
  private archiveCipherUtilitiesService = inject(ArchiveCipherUtilitiesService);
  private routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private vaultFilterService = inject(VaultFilterService);
  private routedVaultFilterService = inject(RoutedVaultFilterService);
  private vaultItemTransferService: VaultItemsTransferService = inject(VaultItemsTransferService);
  private searchBarService = inject(SearchBarService);

  protected activeFilter: VaultFilter = new VaultFilter();
  private activeUserId: UserId | null = null;
  protected showAddCipherBtn: boolean = false;

  private organizations$: Observable<Organization[]> = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filterOutNullish(),
    switchMap((id) => this.organizationService.organizations$(id)),
  );

  protected canAccessAttachments$ = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => !!account),
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );

  protected deactivatedOrgIcon = DeactivatedOrg;
  protected emptyTrashIcon = EmptyTrash;
  protected favoritesIcon = FavoritesIcon;
  protected itemTypesIcon = ItemTypes;
  protected noResultsIcon = NoResults;
  protected performingInitialLoad = true;
  protected refreshing = false;
  protected processingEvent = false;
  protected filter: RoutedVaultFilterModel = {};
  protected canAccessPremium: boolean;
  protected allOrganizations: Organization[] = [];
  protected allCollections: CollectionView[] = [];
  protected collectionsToDisplay: CollectionView[] = [];
  protected searchPlaceholderText: string;
  private userId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected ciphers: C[] = [];
  protected filteredCiphers: C[] = [];
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

  async ngOnInit() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.activeUserId = activeUserId;

    this.searchBarService.setEnabled(false);

    // Clear cipher selection on page load/reload to prevent flash of content
    const currentParams = await firstValueFrom(this.route.queryParams);
    if (currentParams.itemId || currentParams.cipherId) {
      await this.router.navigate([], {
        queryParams: { itemId: null, cipherId: null, action: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    }

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
      void this.ngZone.run(async () => {
        if (message.command === "syncCompleted" && message.successfully) {
          this.refresh();
        }
        if (this.activeUserId) {
          void this.vaultItemTransferService.enforceOrganizationDataOwnership(this.activeUserId);
        }
      });
    });

    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeFilter) => {
        this.activeFilter = activeFilter;
        this.searchPlaceholderText = this.i18nService.t(
          this.calculateSearchBarLocalizationString(activeFilter),
        );
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

    const ciphers$ = combineLatest([
      allowedCiphers$,
      filter$,
      this.currentSearchText$,
      this.cipherArchiveService.hasArchiveFlagEnabled$,
    ]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, searchText, showArchiveVault]) => {
        const failedCiphers =
          (await firstValueFrom(this.cipherService.failedToDecryptCiphers$(activeUserId))) ?? [];
        const filterFunction = createFilterFunction(filter, showArchiveVault);
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

    firstSetup$
      .pipe(
        switchMap(() => this.route.queryParams),
        switchMap(async (params) => {
          const cipherId = getCipherIdFromParams(params);
          if (!cipherId) {
            return;
          }
          const cipher = await this.cipherService.get(cipherId, activeUserId);

          if (cipher) {
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

            const cipherView = await cipher
              .decrypt(await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId))
              .catch((): any => null);

            if (cipherView) {
              if (action === "view") {
                await this.viewCipher(cipherView).catch(() => {});
              } else if (action === "clone") {
                await this.cloneCipher(cipherView).catch(() => {});
              } else {
                await this.editCipher(cipherView).catch(() => {});
              }
            }
          } else {
            await this.handleUnknownCipher();
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
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(
        ([filter, canAccessPremium, allCollections, allOrganizations, ciphers, collections]) => {
          this.filter = filter;
          this.canAccessPremium = canAccessPremium;
          this.allCollections = allCollections;
          this.allOrganizations = allOrganizations;
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

    void this.vaultItemTransferService.enforceOrganizationDataOwnership(this.activeUserId);
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
        case "viewAttachments": {
          const cipher = await this.cipherService.getFullCipherView(event.item);
          await this.viewCipher(cipher);
          break;
        }
        case "clone": {
          const cipher = await this.cipherService.getFullCipherView(event.item);
          await this.cloneCipher(cipher);
          break;
        }
        case "restore":
          if (event.items.length === 1) {
            await this.restoreCipher(event.items[0] as CipherView);
          }
          break;
        case "delete":
          await this.handleDeleteEvent(event.items);
          break;
        case "copyField":
          await this.copy(event.item, event.field);
          break;
        case "assignToCollections":
          if (event.items.length === 1) {
            const cipher = await this.cipherService.getFullCipherView(event.items[0]);
            await this.shareCipher(cipher);
          }
          break;
        case "archive":
          if (event.items.length === 1) {
            const cipher = await this.cipherService.getFullCipherView(event.items[0]);
            if (!cipher.organizationId && !cipher.isDeleted && !cipher.isArchived) {
              if (!(await firstValueFrom(this.userCanArchive$))) {
                await this.premiumUpgradePromptService.promptForPremium();
                return;
              }

              await this.archiveCipherUtilitiesService.archiveCipher(cipher);
              this.refresh();
            }
          }
          break;
        case "unarchive":
          if (event.items.length === 1) {
            const cipher = await this.cipherService.getFullCipherView(event.items[0]);
            await this.archiveCipherUtilitiesService.unarchiveCipher(cipher);
            this.refresh();
          }
          break;
        case "toggleFavorite":
          await this.handleFavoriteEvent(event.item);
          break;
        case "editCipher": {
          const fullCipher = await this.cipherService.getFullCipherView(event.item);
          await this.editCipher(fullCipher);
          break;
        }
      }
    } finally {
      this.processingEvent = false;
    }
  }

  async handleUnknownCipher() {
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

  /**
   * Handler for Vault level CopyClickDirectives to send the minimizeOnCopy message
   */
  onCopy() {
    this.messagingService.send("minimizeOnCopy");
  }

  async viewCipher(c: CipherViewLike) {
    if (CipherViewLikeUtils.decryptionFailure(c)) {
      DecryptionFailureDialogComponent.open(this.dialogService, {
        cipherIds: [c.id as CipherId],
      });
      return;
    }
    const cipher = await this.cipherService.getFullCipherView(c);
    if (await this.shouldReprompt(cipher, "view")) {
      return;
    }

    const config = await this.formConfigService.buildConfig(
      "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openDrawer({
      mode: "view",
      formConfig: config,
    });
  }


  async shouldReprompt(cipher: CipherView, action: "edit" | "clone" | "view"): Promise<boolean> {
    return !(await this.passwordReprompt(cipher));
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


  async editCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "edit")) {
      return;
    }

    const config = await this.formConfigService.buildConfig(
      "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    if (!cipher.edit && config) {
      config.mode = "partial-edit";
    }

    await this.openDrawer({
      mode: "form",
      formConfig: config,
    });
  }

  async cloneCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "clone")) {
      return;
    }

    const config = await this.formConfigService.buildConfig(
      "clone",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openDrawer({
      mode: "form",
      formConfig: config,
    });
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
    const cipherType = type || this.activeFilter.cipherType;

    const config = await this.formConfigService.buildConfig("add", null, cipherType);

    // Apply filter-based prefill
    if (this.activeFilter.collectionId != null) {
      const collections = this.allCollections.filter(
        (c) => c.id === this.activeFilter.collectionId,
      );
      if (collections.length > 0) {
        config.initialValues = {
          ...config.initialValues,
          organizationId: collections[0].organizationId as OrganizationId,
          collectionIds: [this.activeFilter.collectionId] as CollectionId[],
        };
      }
    } else if (this.activeFilter.organizationId) {
      config.initialValues = {
        ...config.initialValues,
        organizationId: this.activeFilter.organizationId as OrganizationId,
      };
    }

    if (this.activeFilter.folderId && this.activeFilter.selectedFolderNode) {
      config.initialValues = {
        ...config.initialValues,
        folderId: this.activeFilter.folderId,
      };
    }

    await this.openDrawer({
      mode: "form",
      formConfig: config,
    });

    if (type === CipherType.SshKey) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("sshKeyGenerated"),
      });
    }
  }


  async deleteCipher(c: CipherView): Promise<boolean> {
    if (!(await this.repromptCipher([c as C]))) {
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

    // this.cipherId = null;
    // this.cipher.set(null);
    // this.action.set(null);
    // this.changeDetectorRef.detectChanges();
    // await this.go().catch(() => {});
  }

  restoreCipher = async (c: CipherView): Promise<boolean> => {
    if (!CipherViewLikeUtils.isDeleted(c)) {
      return;
    }

    if (!c.edit) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher([c as C]))) {
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

    // this.cipherId = null;
    // this.action.set(null);
    // this.changeDetectorRef.detectChanges();
    // await this.go().catch(() => {});
  };


  async handleFavoriteEvent(cipher: C) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherFullView = await this.cipherService.getFullCipherView(cipher);
    cipherFullView.favorite = !cipherFullView.favorite;
    await this.cipherService.updateWithServer(cipherFullView, activeUserId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        cipherFullView.favorite ? "itemAddedToFavorites" : "itemRemovedFromFavorites",
      ),
    });

    this.refresh();
  }

  private async handleDeleteEvent(items: VaultItem<C>[]) {
    const ciphers: C[] = items.filter((i) => i.collection === undefined).map((i) => i.cipher);
    const collections = items.filter((i) => i.cipher === undefined).map((i) => i.collection);
    if (ciphers.length === 1 && collections.length === 0) {
      await this.deleteCipher(ciphers[0] as CipherView);
    }
  }

  private getAvailableCollections(cipher: CipherView): CollectionView[] {
    const orgId = cipher.organizationId;
    if (!orgId || orgId === "MyVault") {
      return [];
    }

    const organization = this.allOrganizations.find((o) => o.id === orgId);
    return this.allCollections.filter((c) => c.organizationId === organization?.id && !c.readOnly);
  }

  private showMissingPermissionsError() {
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t("missingPermissions"),
    });
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
      return "searchType";
    }
    if (vaultFilter.folderId != null && vaultFilter.folderId !== "none") {
      return "searchFolder";
    }
    if (vaultFilter.collectionId != null) {
      return "searchCollection";
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
    this.messagingService.send("newFolder");
  }

  async editFolder(folderId: string) {
    if (!this.activeUserId) {
      return;
    }
    const folderView = await firstValueFrom(
      this.folderService.getDecrypted$(folderId, this.activeUserId),
    );

    if (!folderView) {
      return;
    }
  }

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  /** Trigger a refresh of the vault data */
  private refresh() {
    this.refresh$.next();
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
   * Opens the vault item drawer dialog with the provided parameters.
   * Handles the result when the drawer closes and refreshes the vault if needed.
   */
  private async openDrawer(params: VaultItemDrawerParams) {
    const dialogRef = VaultItemDrawerComponent.open(this.dialogService, params);
    const result = await firstValueFrom(dialogRef.closed);

    if (result === VaultItemDrawerResult.Saved || result === VaultItemDrawerResult.Deleted) {
      this.refresh();
    }
  }

  private async passwordReprompt(cipher: CipherView) {
    if (cipher.reprompt === CipherRepromptType.None) {
      return true;
    }
    return await this.passwordRepromptService.showPasswordPrompt();
  }

  /**
   * Returns the password for a `CipherViewLike` object.
   * `CipherListView` does not contain the password, the full `CipherView` needs to be fetched.
   */
  private async getPasswordFromCipherViewLike(cipher: C): Promise<string | undefined> {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      return Promise.resolve(cipher.login?.password);
    }

    const _cipher = await this.cipherService.get(uuidAsString(cipher.id), this.activeUserId);
    const cipherView = await this.cipherService.decrypt(_cipher, this.activeUserId);
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
