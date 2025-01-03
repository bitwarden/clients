// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
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
} from "rxjs";
import {
  concatMap,
  debounceTime,
  filter,
  first,
  map,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs/operators";

import {
  CollectionData,
  CollectionDetailsResponse,
  CollectionService,
  CollectionView,
  Unassigned,
} from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { DialogService, Icons, ToastService } from "@bitwarden/components";
import {
  CipherFormConfig,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { TrialFlowService } from "../../billing/services/trial-flow.service";
import { FreeTrial } from "../../core/types/free-trial";
import { SharedModule } from "../../shared/shared.module";
import { AssignCollectionsWebComponent } from "../components/assign-collections";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../components/collection-dialog";
import {
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "../components/vault-item-dialog/vault-item-dialog.component";
import { VaultItem } from "../components/vault-items/vault-item";
import { VaultItemEvent } from "../components/vault-items/vault-item-event";
import { VaultItemsModule } from "../components/vault-items/vault-items.module";
import { getNestedCollectionTree } from "../utils/collection-utils";

import { AddEditComponent } from "./add-edit.component";
import {
  AttachmentDialogCloseResult,
  AttachmentDialogResult,
  AttachmentsV2Component,
} from "./attachments-v2.component";
import { AttachmentsComponent } from "./attachments.component";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "./bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import {
  BulkMoveDialogResult,
  openBulkMoveDialog,
} from "./bulk-action-dialogs/bulk-move-dialog/bulk-move-dialog.component";
import { FolderAddEditDialogResult, openFolderAddEditDialog } from "./folder-add-edit.component";
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
const SearchTextDebounceInterval = 200;

@Component({
  standalone: true,
  selector: "app-vault",
  templateUrl: "vault.component.html",
  imports: [
    VaultHeaderComponent,
    VaultOnboardingComponent,
    VaultBannersComponent,
    VaultFilterModule,
    VaultItemsModule,
    SharedModule,
    DecryptionFailureDialogComponent,
  ],
  providers: [
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
    DefaultCipherFormConfigService,
  ],
})
export class VaultComponent implements OnInit, OnDestroy {
  @ViewChild("vaultFilter", { static: true }) filterComponent: VaultFilterComponent;
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;
  @ViewChild("folderAddEdit", { read: ViewContainerRef, static: true })
  folderAddEditModalRef: ViewContainerRef;
  @ViewChild("cipherAddEdit", { read: ViewContainerRef, static: true })
  cipherAddEditModalRef: ViewContainerRef;
  @ViewChild("share", { read: ViewContainerRef, static: true }) shareModalRef: ViewContainerRef;
  @ViewChild("collectionsModal", { read: ViewContainerRef, static: true })
  collectionsModalRef: ViewContainerRef;

  trashCleanupWarning: string = null;
  kdfIterations: number;
  activeFilter: VaultFilter = new VaultFilter();

  protected noItemIcon = Icons.Search;
  protected performingInitialLoad = true;
  protected refreshing = false;
  protected processingEvent = false;
  protected filter: RoutedVaultFilterModel = {};
  protected showBulkMove: boolean;
  protected canAccessPremium: boolean;
  protected allCollections: CollectionView[];
  protected allOrganizations: Organization[] = [];
  protected ciphers: CipherView[];
  protected collections: CollectionView[];
  protected isEmpty: boolean;
  protected selectedCollection: TreeNode<CollectionView> | undefined;
  protected canCreateCollections = false;
  protected currentSearchText$: Observable<string>;
  private activeUserId: UserId;
  private searchText$ = new Subject<string>();
  private refresh$ = new BehaviorSubject<void>(null);
  private destroy$ = new Subject<void>();
  private extensionRefreshEnabled: boolean;
  private hasSubscription$ = new BehaviorSubject<boolean>(false);

  private vaultItemDialogRef?: DialogRef<VaultItemDialogResult> | undefined;
  private readonly unpaidSubscriptionDialog$ = this.organizationService.organizations$.pipe(
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
  );

  protected organizationsPaymentStatus$: Observable<FreeTrial[]> = combineLatest([
    this.organizationService.organizations$.pipe(
      map(
        (organizations) =>
          organizations?.filter((org) => org.isOwner && org.canViewBillingHistory) ?? [],
      ),
    ),
    this.hasSubscription$,
  ]).pipe(
    switchMap(([ownerOrgs, hasSubscription]) => {
      if (!ownerOrgs || ownerOrgs.length === 0 || !hasSubscription) {
        return of([]);
      }
      return combineLatest(
        ownerOrgs.map((org) =>
          combineLatest([
            this.organizationApiService.getSubscription(org.id),
            this.organizationBillingService.getPaymentSource(org.id),
          ]).pipe(
            map(([subscription, paymentSource]) => {
              return this.trialFlowService.checkForOrgsWithUpcomingPaymentIssues(
                org,
                subscription,
                paymentSource,
              );
            }),
          ),
        ),
      );
    }),
    map((results) => results.filter((result) => result.shownBanner)),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  constructor(
    private syncService: SyncService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private i18nService: I18nService,
    private modalService: ModalService,
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
    private configService: ConfigService,
    private apiService: ApiService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
    private accountService: AccountService,
    private cipherFormConfigService: DefaultCipherFormConfigService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    protected billingApiService: BillingApiServiceAbstraction,
    private trialFlowService: TrialFlowService,
    private organizationBillingService: OrganizationBillingServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning",
    );

    this.activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

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
    const allCollections$ = this.collectionService.decryptedCollections$;
    const nestedCollections$ = allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections)),
    );

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

    const ciphers$ = combineLatest([
      this.cipherService.cipherViews$.pipe(filter((c) => c !== null)),
      filter$,
      this.currentSearchText$,
    ]).pipe(
      withLatestFrom(this.cipherService.failedToDecryptCiphers$), // Not in combineLatest to avoid redundant emissions
      filter(
        ([[ciphers, filter], failedCiphers]) =>
          ciphers != undefined && filter != undefined && failedCiphers != undefined,
      ),
      concatMap(async ([[ciphers, filter, searchText], failedCiphers]) => {
        const filterFunction = createFilterFunction(filter);
        // Append any failed to decrypt ciphers to the top of the cipher list
        const allCiphers = [...failedCiphers, ...ciphers];

        if (await this.searchService.isSearchable(searchText)) {
          return await this.searchService.searchCiphers(searchText, [filterFunction], allCiphers);
        }

        return allCiphers.filter(filterFunction);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const collections$ = combineLatest([nestedCollections$, filter$, this.currentSearchText$]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      concatMap(async ([collections, filter, searchText]) => {
        if (filter.collectionId === undefined || filter.collectionId === Unassigned) {
          return [];
        }
        let collectionsToReturn = [];
        if (filter.organizationId !== undefined && filter.collectionId === All) {
          collectionsToReturn = collections
            .filter((c) => c.node.organizationId === filter.organizationId)
            .map((c) => c.node);
        } else if (filter.collectionId === All) {
          collectionsToReturn = collections.map((c) => c.node);
        } else {
          const selectedCollection = ServiceUtils.getTreeNodeObjectFromList(
            collections,
            filter.collectionId,
          );
          collectionsToReturn = selectedCollection?.children.map((c) => c.node) ?? [];
        }

        if (await this.searchService.isSearchable(searchText)) {
          collectionsToReturn = this.searchPipe.transform(
            collectionsToReturn,
            searchText,
            (collection) => collection.name,
            (collection) => collection.id,
          );
        }

        return collectionsToReturn;
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
        // Only process the queryParams if the dialog is not open (only when extension refresh is enabled)
        filter(() => this.vaultItemDialogRef == undefined || !this.extensionRefreshEnabled),
        switchMap(async (params) => {
          const cipherId = getCipherIdFromParams(params);
          if (cipherId) {
            if (await this.cipherService.get(cipherId)) {
              let action = params.action;
              // Default to "view" if extension refresh is enabled
              if (action == null && this.extensionRefreshEnabled) {
                action = "view";
              }

              if (action == "showFailedToDecrypt") {
                DecryptionFailureDialogComponent.open(this.dialogService, {
                  cipherIds: [cipherId as CipherId],
                });
                await this.router.navigate([], {
                  queryParams: { itemId: null, cipherId: null, action: null },
                  queryParamsHandling: "merge",
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
        switchMap(() => this.cipherService.failedToDecryptCiphers$),
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

    this.unpaidSubscriptionDialog$.pipe(takeUntil(this.destroy$)).subscribe();

    firstSetup$
      .pipe(
        switchMap(() => this.refresh$),
        tap(() => (this.refreshing = true)),
        switchMap(() =>
          combineLatest([
            filter$,
            this.billingAccountProfileStateService.hasPremiumFromAnySource$,
            allCollections$,
            this.organizationService.organizations$,
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
        },
      );

    // Check if the extension refresh feature flag is enabled
    this.extensionRefreshEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.ExtensionRefresh,
    );
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
    this.vaultFilterService.clearOrganizationFilter();
  }

  async onVaultItemsEvent(event: VaultItemEvent) {
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
      }
    } finally {
      this.processingEvent = false;
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

  addFolder = async (): Promise<void> => {
    openFolderAddEditDialog(this.dialogService);
  };

  editFolder = async (folder: FolderFilter): Promise<void> => {
    const dialog = openFolderAddEditDialog(this.dialogService, {
      data: {
        folderId: folder.id,
      },
    });

    const result = await lastValueFrom(dialog.closed);

    if (result === FolderAddEditDialogResult.Deleted) {
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
   * Uses the new AttachmentsV2Component if the extensionRefresh feature flag is enabled.
   *
   * @param cipher
   * @returns
   */
  async editCipherAttachments(cipher: CipherView) {
    if (cipher?.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      await this.go({ cipherId: null, itemId: null });
      return;
    }

    if (cipher.organizationId == null && !this.canAccessPremium) {
      this.messagingService.send("premiumRequired");
      return;
    } else if (cipher.organizationId != null) {
      const org = await this.organizationService.get(cipher.organizationId);
      if (org != null && (org.maxStorageGb == null || org.maxStorageGb === 0)) {
        this.messagingService.send("upgradeOrganization", {
          organizationId: cipher.organizationId,
        });
        return;
      }
    }

    const canEditAttachments = await this.canEditAttachments(cipher);

    let madeAttachmentChanges = false;

    if (this.extensionRefreshEnabled) {
      const dialogRef = AttachmentsV2Component.open(this.dialogService, {
        cipherId: cipher.id as CipherId,
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

    const [modal] = await this.modalService.openViewRef(
      AttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        comp.viewOnly = !canEditAttachments;
        comp.onUploadedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
        comp.onDeletedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
        comp.onReuploadedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
      },
    );

    modal.onClosed.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (madeAttachmentChanges) {
        this.refresh();
      }
      madeAttachmentChanges = false;
    });
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

  async addCipher(cipherType?: CipherType) {
    const type = cipherType ?? this.activeFilter.cipherType;

    if (this.extensionRefreshEnabled) {
      return this.addCipherV2(type);
    }

    const component = (await this.editCipher(null)) as AddEditComponent;
    component.type = type;
    if (
      this.activeFilter.organizationId !== "MyVault" &&
      this.activeFilter.organizationId != null
    ) {
      component.organizationId = this.activeFilter.organizationId;
      component.collections = (
        await firstValueFrom(this.vaultFilterService.filteredCollections$)
      ).filter((c) => !c.readOnly && c.id != null);
    }
    const selectedColId = this.activeFilter.collectionId;
    if (selectedColId !== "AllCollections" && selectedColId != null) {
      const selectedCollection = (
        await firstValueFrom(this.vaultFilterService.filteredCollections$)
      ).find((c) => c.id === selectedColId);
      component.organizationId = selectedCollection?.organizationId;
      if (!selectedCollection.readOnly) {
        component.collectionIds = [selectedColId];
      }
    }
    component.folderId = this.activeFilter.folderId;
  }

  /**
   * Opens the add cipher dialog.
   * @param cipherType The type of cipher to add.
   * @returns The dialog reference.
   */
  async addCipherV2(cipherType?: CipherType) {
    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      "add",
      null,
      cipherType,
    );
    cipherFormConfig.initialValues = {
      organizationId:
        this.activeFilter.organizationId !== "MyVault" && this.activeFilter.organizationId != null
          ? (this.activeFilter.organizationId as OrganizationId)
          : null,
      collectionIds:
        this.activeFilter.collectionId !== "AllCollections" &&
        this.activeFilter.collectionId != null
          ? [this.activeFilter.collectionId as CollectionId]
          : [],
      folderId: this.activeFilter.folderId,
    };

    await this.openVaultItemDialog("form", cipherFormConfig);
  }

  async editCipher(cipher: CipherView, cloneMode?: boolean) {
    return this.editCipherId(cipher?.id, cloneMode);
  }

  async editCipherId(id: string, cloneMode?: boolean) {
    const cipher = await this.cipherService.get(id);

    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // didn't pass password prompt, so don't open add / edit modal
      await this.go({ cipherId: null, itemId: null, action: null });
      return;
    }

    if (this.extensionRefreshEnabled) {
      await this.editCipherIdV2(cipher, cloneMode);
      return;
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.cipherAddEditModalRef,
      (comp) => {
        comp.cipherId = id;
        comp.collectionId = this.selectedCollection?.node.id;

        comp.onSavedCipher.pipe(takeUntil(this.destroy$)).subscribe(() => {
          modal.close();
          this.refresh();
        });
        comp.onDeletedCipher.pipe(takeUntil(this.destroy$)).subscribe(() => {
          modal.close();
          this.refresh();
        });
        comp.onRestoredCipher.pipe(takeUntil(this.destroy$)).subscribe(() => {
          modal.close();
          this.refresh();
        });
      },
    );

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    modal.onClosedPromise().then(() => {
      void this.go({ cipherId: null, itemId: null, action: null });
    });

    return childComponent;
  }

  /**
   * Edit a cipher using the new VaultItemDialog.
   *
   * @param cipher
   * @param cloneMode
   */
  private async editCipherIdV2(cipher: Cipher, cloneMode?: boolean) {
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
    const cipher = await this.cipherService.get(id);
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
        await this.collectionService.upsert(c);
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
    if (result.action === CollectionDialogAction.Saved) {
      if (result.collection) {
        // Update CollectionService with the new collection
        const c = new CollectionData(result.collection as CollectionDetailsResponse);
        await this.collectionService.upsert(c);
      }
      this.refresh();
    } else if (result.action === CollectionDialogAction.Deleted) {
      await this.collectionService.delete(result.collection?.id);
      this.refresh();
      // Navigate away if we deleted the collection we were viewing
      if (this.selectedCollection?.node.id === c?.id) {
        await this.router.navigate([], {
          queryParams: { collectionId: this.selectedCollection.parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
    }
  }

  async deleteCollection(collection: CollectionView): Promise<void> {
    const organization = await this.organizationService.get(collection.organizationId);
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
      await this.apiService.deleteCollection(collection.organizationId, collection.id);
      await this.collectionService.delete(collection.id);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedCollectionId", collection.name),
      });
      // Navigate away if we deleted the collection we were viewing
      if (this.selectedCollection?.node.id === collection.id) {
        await this.router.navigate([], {
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

  async bulkAssignToCollections(ciphers: CipherView[]) {
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
        (c) => c.organizationId === organization.id && !c.readOnly,
      );
    }

    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers,
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

    const component = await this.editCipher(cipher, true);

    if (component != null) {
      component.cloneMode = true;
    }
  }

  async restore(c: CipherView): Promise<boolean> {
    if (!c.isDeleted) {
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
      await this.cipherService.restoreWithServer(c.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("restoredItem"),
      });
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkRestore(ciphers: CipherView[]) {
    if (ciphers.some((c) => !c.edit)) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const selectedCipherIds = ciphers.map((cipher) => cipher.id);
    if (selectedCipherIds.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    await this.cipherService.restoreManyWithServer(selectedCipherIds);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("restoredItems"),
    });
    this.refresh();
  }

  private async handleDeleteEvent(items: VaultItem[]) {
    const ciphers = items.filter((i) => i.collection === undefined).map((i) => i.cipher);
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
        this.organizationService.organizations$.pipe(
          map((orgs) => orgs.filter((o) => orgIds.includes(o.id))),
        ),
      );
      await this.bulkDelete(ciphers, collections, orgs);
    }
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
    if (!(await this.repromptCipher([c]))) {
      return;
    }

    if (!c.edit) {
      this.showMissingPermissionsError();
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
      await this.deleteCipherWithServer(c.id, permanent);

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

  async bulkDelete(
    ciphers: CipherView[],
    collections: CollectionView[],
    organizations: Organization[],
  ) {
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
        cipherIds: ciphers.map((c) => c.id),
        organizations: organizations,
        collections: collections,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkDeleteDialogResult.Deleted) {
      this.refresh();
    }
  }

  async bulkMove(ciphers: CipherView[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const selectedCipherIds = ciphers.map((cipher) => cipher.id);
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
      value = await this.totpService.getCode(cipher.login.totp);
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

  protected deleteCipherWithServer(id: string, permanent: boolean) {
    return permanent
      ? this.cipherService.deleteWithServer(id)
      : this.cipherService.softDeleteWithServer(id);
  }

  protected async repromptCipher(ciphers: CipherView[]) {
    const notProtected = !ciphers.find((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  private refresh() {
    this.refresh$.next();
  }

  private async canEditAttachments(cipher: CipherView) {
    if (cipher.organizationId == null || cipher.edit) {
      return true;
    }

    const organization = this.allOrganizations.find((o) => o.id === cipher.organizationId);
    return organization.canEditAllCiphers;
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
}

/**
 * Allows backwards compatibility with
 * old links that used the original `cipherId` param
 */
const getCipherIdFromParams = (params: Params): string => {
  return params["itemId"] || params["cipherId"];
};
