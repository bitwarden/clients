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
  lastValueFrom,
  Observable,
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
  takeUntil,
  tap,
} from "rxjs/operators";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { DEFAULT_PBKDF2_ITERATIONS, EventType, KdfType } from "@bitwarden/common/enums";
import { ServiceUtils } from "@bitwarden/common/misc/serviceUtils";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { CollectionDetailsResponse } from "@bitwarden/common/vault/models/response/collection.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService, Icons } from "@bitwarden/components";

import { CollectionDialogAction, openCollectionDialog } from "../components/collection-dialog";
import { VaultItemEvent } from "../components/vault-items/vault-item-event";
import { getNestedCollectionTree } from "../utils/collection-utils";

import { AddEditComponent } from "./add-edit.component";
import { AttachmentsComponent } from "./attachments.component";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "./bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import {
  BulkMoveDialogResult,
  openBulkMoveDialog,
} from "./bulk-action-dialogs/bulk-move-dialog/bulk-move-dialog.component";
import {
  BulkShareDialogResult,
  openBulkShareDialog,
} from "./bulk-action-dialogs/bulk-share-dialog/bulk-share-dialog.component";
import { CollectionsComponent } from "./collections.component";
import { FolderAddEditDialogResult, openFolderAddEditDialog } from "./folder-add-edit.component";
import { ShareComponent } from "./share.component";
import { VaultFilterComponent } from "./vault-filter/components/vault-filter.component";
import { VaultFilterService } from "./vault-filter/services/abstractions/vault-filter.service";
import { RoutedVaultFilterBridgeService } from "./vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "./vault-filter/services/routed-vault-filter.service";
import { createFilterFunction } from "./vault-filter/shared/models/filter-function";
import {
  All,
  RoutedVaultFilterModel,
  Unassigned,
} from "./vault-filter/shared/models/routed-vault-filter.model";
import { VaultFilter } from "./vault-filter/shared/models/vault-filter.model";
import { FolderFilter, OrganizationFilter } from "./vault-filter/shared/models/vault-filter.type";

const BroadcasterSubscriptionId = "VaultComponent";
const SearchTextDebounceInterval = 200;

@Component({
  selector: "app-vault",
  templateUrl: "vault.component.html",
  providers: [RoutedVaultFilterService, RoutedVaultFilterBridgeService],
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

  showVerifyEmail = false;
  showBrowserOutdated = false;
  showPremiumCallout = false;
  showLowKdf = false;
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
  protected allOrganizations: Organization[];
  protected ciphers: CipherView[];
  protected collections: CollectionView[];
  protected isEmpty: boolean;
  protected selectedCollection: TreeNode<CollectionView> | undefined;
  protected canCreateCollections = false;
  protected currentSearchText$: Observable<string>;

  private searchText$ = new Subject<string>();
  private refresh$ = new BehaviorSubject<void>(null);
  private destroy$ = new Subject<void>();

  constructor(
    private syncService: SyncService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private i18nService: I18nService,
    private modalService: ModalService,
    private dialogService: DialogService,
    private tokenService: TokenService,
    private cryptoService: CryptoService,
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private stateService: StateService,
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
    private configService: ConfigServiceAbstraction,
    private userVerificationService: UserVerificationService
  ) {}

  async ngOnInit() {
    this.showBrowserOutdated = window.navigator.userAgent.indexOf("MSIE") !== -1;
    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning"
    );

    const firstSetup$ = this.route.queryParams.pipe(
      first(),
      switchMap(async (params: Params) => {
        this.showVerifyEmail = !(await this.tokenService.getEmailVerified());
        this.showLowKdf = (await this.userVerificationService.hasMasterPassword())
          ? await this.isLowKdfIteration()
          : false;
        await this.syncService.fullSync(false);

        const canAccessPremium = await this.stateService.getCanAccessPremium();
        this.showPremiumCallout =
          !this.showVerifyEmail && !canAccessPremium && !this.platformUtilsService.isSelfHost();

        const cipherId = getCipherIdFromParams(params);
        if (!cipherId) {
          return;
        }
        const cipherView = new CipherView();
        cipherView.id = cipherId;
        if (params.action === "clone") {
          await this.cloneCipher(cipherView);
        } else if (params.action === "edit") {
          await this.editCipher(cipherView);
        }
      }),
      shareReplay({ refCount: true, bufferSize: 1 })
    );

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
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
    const canAccessPremium$ = Utils.asyncToObservable(() =>
      this.stateService.getCanAccessPremium()
    ).pipe(shareReplay({ refCount: true, bufferSize: 1 }));
    const allCollections$ = Utils.asyncToObservable(() => this.collectionService.getAllDecrypted());
    const nestedCollections$ = allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections))
    );

    this.searchText$
      .pipe(debounceTime(SearchTextDebounceInterval), takeUntil(this.destroy$))
      .subscribe((searchText) =>
        this.router.navigate([], {
          queryParams: { search: Utils.isNullOrEmpty(searchText) ? null : searchText },
          queryParamsHandling: "merge",
          replaceUrl: true,
        })
      );

    this.currentSearchText$ = this.route.queryParams.pipe(map((queryParams) => queryParams.search));

    const ciphers$ = combineLatest([
      Utils.asyncToObservable(() => this.cipherService.getAllDecrypted()),
      filter$,
      this.currentSearchText$,
    ]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, searchText]) => {
        const filterFunction = createFilterFunction(filter);

        if (this.searchService.isSearchable(searchText)) {
          return await this.searchService.searchCiphers(searchText, [filterFunction], ciphers);
        }

        return ciphers.filter(filterFunction);
      }),
      shareReplay({ refCount: true, bufferSize: 1 })
    );

    const collections$ = combineLatest([nestedCollections$, filter$, this.currentSearchText$]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      map(([collections, filter, searchText]) => {
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
            filter.collectionId
          );
          collectionsToReturn = selectedCollection?.children.map((c) => c.node) ?? [];
        }

        if (this.searchService.isSearchable(searchText)) {
          collectionsToReturn = this.searchPipe.transform(
            collectionsToReturn,
            searchText,
            (collection) => collection.name,
            (collection) => collection.id
          );
        }

        return collectionsToReturn;
      }),
      shareReplay({ refCount: true, bufferSize: 1 })
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
      shareReplay({ refCount: true, bufferSize: 1 })
    );

    firstSetup$
      .pipe(
        switchMap(() => this.route.queryParams),
        switchMap(async (params) => {
          const cipherId = getCipherIdFromParams(params);
          if (cipherId) {
            if ((await this.cipherService.get(cipherId)) != null) {
              this.editCipherId(cipherId);
            } else {
              this.platformUtilsService.showToast(
                "error",
                this.i18nService.t("errorOccurred"),
                this.i18nService.t("unknownCipher")
              );
              this.router.navigate([], {
                queryParams: { itemId: null, cipherId: null },
                queryParamsHandling: "merge",
              });
            }
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

    firstSetup$
      .pipe(
        switchMap(() => this.refresh$),
        tap(() => (this.refreshing = true)),
        switchMap(() =>
          combineLatest([
            filter$,
            canAccessPremium$,
            allCollections$,
            this.organizationService.organizations$,
            ciphers$,
            collections$,
            selectedCollection$,
          ])
        ),
        takeUntil(this.destroy$)
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
            (o) => o.canCreateNewCollections && !o.isProviderUser
          );

          this.showBulkMove =
            filter.type !== "trash" &&
            (filter.organizationId === undefined || filter.organizationId === Unassigned);
          this.isEmpty = collections?.length === 0 && ciphers?.length === 0;

          // This is a temporary fix to avoid double fetching collections.
          // TODO: Remove when implementing new VVR menu
          this.vaultFilterService.reloadCollections(allCollections);

          this.performingInitialLoad = false;
          this.refreshing = false;
        }
      );
  }

  get isShowingCards() {
    return (
      this.showBrowserOutdated || this.showPremiumCallout || this.showVerifyEmail || this.showLowKdf
    );
  }

  emailVerified(verified: boolean) {
    this.showVerifyEmail = !verified;
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onVaultItemsEvent(event: VaultItemEvent) {
    this.processingEvent = true;
    try {
      if (event.type === "viewAttachments") {
        await this.editCipherAttachments(event.item);
      } else if (event.type === "viewCollections") {
        await this.editCipherCollections(event.item);
      } else if (event.type === "clone") {
        await this.cloneCipher(event.item);
      } else if (event.type === "restore") {
        if (event.items.length === 1) {
          await this.restore(event.items[0]);
        } else {
          await this.bulkRestore(event.items);
        }
      } else if (event.type === "delete") {
        const ciphers = event.items.filter((i) => i.collection === undefined).map((i) => i.cipher);
        if (ciphers.length === 1) {
          await this.deleteCipher(ciphers[0]);
        } else {
          await this.bulkDelete(ciphers);
        }
      } else if (event.type === "moveToFolder") {
        await this.bulkMove(event.items);
      } else if (event.type === "moveToOrganization") {
        if (event.items.length === 1) {
          await this.shareCipher(event.items[0]);
        } else {
          await this.bulkShare(event.items);
        }
      } else if (event.type === "copyField") {
        await this.copy(event.item, event.field);
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
    this.filterComponent.filters?.organizationFilter?.action(orgNode);
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
      this.router.navigate([], {
        queryParams: { folderId: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    }
  };

  filterSearchText(searchText: string) {
    this.searchText$.next(searchText);
  }

  async editCipherAttachments(cipher: CipherView) {
    if (cipher?.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      this.go({ cipherId: null, itemId: null });
      return;
    }

    const canAccessPremium = await this.stateService.getCanAccessPremium();
    if (cipher.organizationId == null && !canAccessPremium) {
      this.messagingService.send("premiumRequired");
      return;
    } else if (cipher.organizationId != null) {
      const org = this.organizationService.get(cipher.organizationId);
      if (org != null && (org.maxStorageGb == null || org.maxStorageGb === 0)) {
        this.messagingService.send("upgradeOrganization", {
          organizationId: cipher.organizationId,
        });
        return;
      }
    }

    let madeAttachmentChanges = false;
    const [modal] = await this.modalService.openViewRef(
      AttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        comp.onUploadedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
        comp.onDeletedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
        comp.onReuploadedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
      }
    );

    modal.onClosed.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (madeAttachmentChanges) {
        this.refresh();
      }
      madeAttachmentChanges = false;
    });
  }

  async shareCipher(cipher: CipherView) {
    if (cipher?.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      this.go({ cipherId: null, itemId: null });
      return;
    }
    const [modal] = await this.modalService.openViewRef(
      ShareComponent,
      this.shareModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        comp.onSharedCipher.pipe(takeUntil(this.destroy$)).subscribe(() => {
          modal.close();
          this.refresh();
        });
      }
    );
  }

  async editCipherCollections(cipher: CipherView) {
    const [modal] = await this.modalService.openViewRef(
      CollectionsComponent,
      this.collectionsModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        comp.onSavedCollections.pipe(takeUntil(this.destroy$)).subscribe(() => {
          modal.close();
          this.refresh();
        });
      }
    );
  }

  async addCipher() {
    const component = await this.editCipher(null);
    component.type = this.activeFilter.cipherType;
    if (this.activeFilter.organizationId !== "MyVault") {
      component.organizationId = this.activeFilter.organizationId;
      component.collections = (
        await firstValueFrom(this.vaultFilterService.filteredCollections$)
      ).filter((c) => !c.readOnly && c.id != null);
    }
    const selectedColId = this.activeFilter.collectionId;
    if (selectedColId !== "AllCollections") {
      component.organizationId = component.collections.find(
        (collection) => collection.id === selectedColId
      )?.organizationId;
      component.collectionIds = [selectedColId];
    }
    component.folderId = this.activeFilter.folderId;
  }

  async navigateToCipher(cipher: CipherView) {
    this.go({ itemId: cipher?.id });
  }

  async editCipher(cipher: CipherView) {
    return this.editCipherId(cipher?.id);
  }

  async editCipherId(id: string) {
    const cipher = await this.cipherService.get(id);
    // if cipher exists (cipher is null when new) and MP reprompt
    // is on for this cipher, then show password reprompt
    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // didn't pass password prompt, so don't open add / edit modal
      this.go({ cipherId: null, itemId: null });
      return;
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.cipherAddEditModalRef,
      (comp) => {
        comp.cipherId = id;
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
      }
    );

    modal.onClosedPromise().then(() => {
      this.go({ cipherId: null, itemId: null });
    });

    return childComponent;
  }

  async addCollection() {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: this.allOrganizations
          .filter((o) => o.canCreateNewCollections)
          .sort(Utils.getSortFunction(this.i18nService, "name"))[0].id,
        parentCollectionId: this.filter.collectionId,
        showOrgSelector: true,
        collectionIds: this.allCollections.map((c) => c.id),
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
      // TODO: Remove collection from collectionService when collection
      // deletion is implemented in the individual vault in AC-1347
      this.refresh();
    }
  }

  async cloneCipher(cipher: CipherView) {
    const component = await this.editCipher(cipher);
    component.cloneMode = true;
  }

  async restore(c: CipherView): Promise<boolean> {
    if (!(await this.repromptCipher([c]))) {
      return;
    }

    if (!c.isDeleted) {
      return;
    }

    try {
      await this.cipherService.restoreWithServer(c.id);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItem"));
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkRestore(ciphers: CipherView[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const selectedCipherIds = ciphers.map((cipher) => cipher.id);
    if (selectedCipherIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    await this.cipherService.restoreManyWithServer(selectedCipherIds);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItems"));
    this.refresh();
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
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
      await this.deleteCipherWithServer(c.id, permanent);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem")
      );
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkDelete(ciphers: CipherView[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    const selectedIds = ciphers.map((cipher) => cipher.id);
    if (selectedIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }
    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: { permanent: this.filter.type === "trash", cipherIds: selectedIds },
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
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
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
      this.platformUtilsService.showToast("info", null, this.i18nService.t("unexpectedError"));
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
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey))
    );

    if (field === "password") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (field === "totp") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedHiddenField, cipher.id);
    }
  }

  async bulkShare(ciphers: CipherView[]) {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    if (ciphers.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
      return;
    }

    const dialog = openBulkShareDialog(this.dialogService, { data: { ciphers } });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkShareDialogResult.Shared) {
      this.refresh();
    }
  }

  protected deleteCipherWithServer(id: string, permanent: boolean) {
    return permanent
      ? this.cipherService.deleteWithServer(id)
      : this.cipherService.softDeleteWithServer(id);
  }

  async isLowKdfIteration() {
    const kdfType = await this.stateService.getKdfType();
    const kdfOptions = await this.stateService.getKdfConfig();
    return kdfType === KdfType.PBKDF2_SHA256 && kdfOptions.iterations < DEFAULT_PBKDF2_ITERATIONS;
  }

  protected async repromptCipher(ciphers: CipherView[]) {
    const notProtected = !ciphers.find((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  private refresh() {
    this.refresh$.next();
  }

  private go(queryParams: any = null) {
    if (queryParams == null) {
      queryParams = {
        favorites: this.activeFilter.isFavorites || null,
        type: this.activeFilter.cipherType,
        folderId: this.activeFilter.folderId,
        collectionId: this.activeFilter.collectionId,
        deleted: this.activeFilter.isDeleted || null,
      };
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: "merge",
      replaceUrl: true,
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
