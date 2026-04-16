// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
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
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, OrganizationId, UserId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
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
import { DialogRef, DialogService, ToastService, SearchModule } from "@bitwarden/components";
import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogResult,
  AddItemDialogCloseResult,
  AddItemDialogComponent,
  AddItemDialogResult,
  AttachmentsV2Component,
  AttachmentDialogResult,
  CipherFormConfig,
  CipherFormConfigService,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  DefaultCipherFormConfigService,
  DefaultVaultItemsTransferService,
  PasswordRepromptService,
  ArchiveCipherUtilitiesService,
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
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header/desktop-header.component";
import { SearchBarService } from "../../../app/layout/search/search-bar.service";
import { AssignCollectionsDesktopComponent } from "../vault/assign-collections";

import { VaultItemEvent } from "./vault-items/vault-item-event";
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
    DesktopHeaderComponent,
    NewCipherMenuComponent,
    SearchModule,
    FormsModule,
  ],
  providers: [
    { provide: VaultItemsTransferService, useClass: DefaultVaultItemsTransferService },
    { provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService },
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
  private logService = inject(LogService);
  private organizationService = inject(OrganizationService);
  private restrictedItemTypesService = inject(RestrictedItemTypesService);
  private cipherArchiveService = inject(CipherArchiveService);
  private policyService = inject(PolicyService);
  private archiveCipherUtilitiesService = inject(ArchiveCipherUtilitiesService);
  private routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private vaultFilterService = inject(VaultFilterService);
  private routedVaultFilterService = inject(RoutedVaultFilterService);
  private vaultItemTransferService: VaultItemsTransferService = inject(VaultItemsTransferService);
  private searchBarService = inject(SearchBarService);

  private destroyRef = inject(DestroyRef);
  private cipherFormConfigService = inject(CipherFormConfigService);
  private activeDrawerRef?: DialogRef<VaultItemDialogResult>;

  protected activeFilter: VaultFilter = new VaultFilter();
  protected cipherRepromptId: string | null = null;

  private activeUserId: UserId | null = null;
  private passwordReprompted: boolean = false;
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

  private organizations$: Observable<Organization[]> = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filterOutNullish(),
    switchMap((id) => this.organizationService.organizations$(id)),
  );

  protected readonly showAddCipherBtn$ = combineLatest([
    this.routedVaultFilterService.filter$,
    this.organizations$,
  ]).pipe(
    map(([filter, organizations]) => {
      const selectedOrg = organizations?.find((org) => org.id === filter?.organizationId);
      if (selectedOrg && !selectedOrg.enabled) {
        return false;
      }

      const emptyStateTypes: EmptyStateType[] = ["trash", "favorites", "archive"];
      if (filter?.type && emptyStateTypes.includes(filter.type as EmptyStateType)) {
        return false;
      }

      return true;
    }),
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
  protected collectionsToDisplay: CollectionView[] = [];
  protected searchPlaceholderText: string;
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

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      void this.ngZone.run(async () => {
        if (message.command === "syncCompleted" && message.successfully) {
          if (this.activeUserId) {
            void this.vaultItemTransferService.enforceOrganizationDataOwnership(this.activeUserId);
          }
          this.refresh();
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

    const ciphers$ = combineLatest([allowedCiphers$, filter$, this.currentSearchText$]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, searchText]) => {
        const failedCiphers =
          (await firstValueFrom(this.cipherService.failedToDecryptCiphers$(activeUserId))) ?? [];
        const filterFunction = createFilterFunction(filter);
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

    this.refresh$
      .pipe(
        tap(() => (this.refreshing = true)),
        switchMap(() =>
          combineLatest([allCollections$, this.organizations$, ciphers$, collections$]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(([allCollections, allOrganizations, ciphers, collections]) => {
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
      });

    void this.vaultItemTransferService.enforceOrganizationDataOwnership(this.activeUserId);
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
    this.vaultFilterService.clearOrganizationFilter();
    this.activeDrawerRef?.close();
  }

  async onVaultItemsEvent(event: VaultItemEvent<C>) {
    switch (event.type) {
      case "viewCipher":
        await this.viewCipher(event.item);
        break;
      case "viewAttachments":
        await this.openAttachmentsDialog(event.item.id as CipherId, event.item.edit);
        break;
      case "clone": {
        const cipher = await this.cipherService.getFullCipherView(event.item);
        await this.cloneCipher(cipher);
        break;
      }
      case "restore": {
        const cipher = await this.cipherService.getFullCipherView(event.items[0]);
        await this.handleRestoreEvent(cipher);
        break;
      }
      case "delete": {
        const cipher = await this.cipherService.getFullCipherView(event.items[0].cipher);
        await this.handleDeleteEvent(cipher);
        break;
      }
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
          if (cipher.isArchived && !cipher.isDeleted) {
            await this.archiveCipherUtilitiesService.unarchiveCipher(cipher);
            this.refresh();
          }
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
    await this.openDialog("view", formConfig);
  }

  async openAttachmentsDialog(cipherId: CipherId, canEditCipher: boolean) {
    if (!this.userHasPremium()) {
      return;
    }
    const dialogRef = AttachmentsV2Component.open(this.dialogService, { cipherId, canEditCipher });
    const result = await firstValueFrom(dialogRef.closed);
    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      this.refresh();
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
    await this.openDialog("form", formConfig);
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
    await this.openDialog("form", formConfig);
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
    const cipherType = type ?? this.activeFilter.cipherType;

    let organizationId: OrganizationId | null = null;
    let collectionIds: CollectionId[] = [];
    let folderId: string | undefined;

    if (this.activeFilter.collectionId != null) {
      const collection = this.allCollections.find((c) => c.id === this.activeFilter.collectionId);
      if (collection) {
        organizationId = collection.organizationId as OrganizationId;
        collectionIds = [this.activeFilter.collectionId as CollectionId];
      }
    } else if (this.activeFilter.organizationId && this.activeFilter.organizationId !== "MyVault") {
      organizationId = this.activeFilter.organizationId as OrganizationId;
    }

    if (this.activeFilter.folderId && this.activeFilter.selectedFolderNode) {
      folderId = this.activeFilter.folderId;
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
    await this.handleRestoreEvent(c as CipherView);
  };

  async handleRestoreEvent(cipher: CipherView): Promise<boolean> {
    let toastMessage;
    if (!cipher.isDeleted) {
      return false;
    }

    if (cipher.isArchived) {
      toastMessage = this.i18nService.t("archivedItemRestored");
    } else {
      toastMessage = this.i18nService.t("restoredItem");
    }

    try {
      await this.cipherService.restoreWithServer(cipher.id, this.activeUserId);
      this.toastService.showToast({
        variant: "success",
        message: toastMessage,
      });
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

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

  async handleDeleteEvent(cipher: CipherView): Promise<boolean> {
    if (!(await this.promptPassword(cipher))) {
      return false;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: cipher.isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      await (cipher.isDeleted
        ? this.cipherService.deleteWithServer(cipher.id, this.activeUserId)
        : this.cipherService.softDeleteWithServer(cipher.id, this.activeUserId));
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem"),
      });
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

  protected async promptPassword(cipher: CipherView): Promise<boolean> {
    if (cipher.reprompt === CipherRepromptType.None || this.passwordReprompted) {
      return true;
    }

    return (this.passwordReprompted = await this.passwordRepromptService.showPasswordPrompt());
  }

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
    const ref = AddItemDialogComponent.open(this.dialogService, {
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

  private async openDialog(mode: VaultItemDialogMode, formConfig: CipherFormConfig) {
    if (this.activeDrawerRef != null && this.dirtyInput()) {
      const keepChanges = await this.wantsToSaveChanges();
      if (keepChanges) {
        return;
      }
      this.activeDrawerRef.close();
    }
    this.activeDrawerRef = VaultItemDialogComponent.openDrawer(this.dialogService, {
      mode,
      formConfig,
      restore: this.restore,
    });
    this.activeDrawerRef.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.activeDrawerRef = undefined;
      void this.router.navigate([], {
        queryParams: { action: null, itemId: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
      if (result === VaultItemDialogResult.Saved || result === VaultItemDialogResult.Deleted) {
        this.refresh();
      }
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
