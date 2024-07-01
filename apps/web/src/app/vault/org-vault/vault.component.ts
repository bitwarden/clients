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
  defer,
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
  takeUntil,
  tap,
} from "rxjs/operators";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserUserDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-user/responses";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
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
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { DialogService, Icons, ToastService } from "@bitwarden/components";
import { CollectionAssignmentResult, PasswordRepromptService } from "@bitwarden/vault";

import { GroupService, GroupView } from "../../admin-console/organizations/core";
import { openEntityEventsDialog } from "../../admin-console/organizations/manage/entity-events.component";
import { VaultFilterService } from "../../vault/individual-vault/vault-filter/services/abstractions/vault-filter.service";
import { VaultFilter } from "../../vault/individual-vault/vault-filter/shared/models/vault-filter.model";
import { AssignCollectionsWebComponent } from "../components/assign-collections";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../components/collection-dialog";
import { VaultItemEvent } from "../components/vault-items/vault-item-event";
import { CollectionAdminService } from "../core/collection-admin.service";
import { CollectionAdminView } from "../core/views/collection-admin.view";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "../individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import { CollectionsDialogResult } from "../individual-vault/collections.component";
import { RoutedVaultFilterBridgeService } from "../individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../individual-vault/vault-filter/services/routed-vault-filter.service";
import { createFilterFunction } from "../individual-vault/vault-filter/shared/models/filter-function";
import {
  All,
  RoutedVaultFilterModel,
  Unassigned,
} from "../individual-vault/vault-filter/shared/models/routed-vault-filter.model";
import { getNestedCollectionTree } from "../utils/collection-utils";

import { AddEditComponent } from "./add-edit.component";
import { AttachmentsComponent } from "./attachments.component";
import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "./bulk-collections-dialog";
import { openOrgVaultCollectionsDialog } from "./collections.component";

const BroadcasterSubscriptionId = "OrgVaultComponent";
const SearchTextDebounceInterval = 200;

enum AddAccessStatusType {
  All = 0,
  AddAccess = 1,
}

@Component({
  selector: "app-org-vault",
  templateUrl: "vault.component.html",
  providers: [RoutedVaultFilterService, RoutedVaultFilterBridgeService],
})
export class VaultComponent implements OnInit, OnDestroy {
  protected Unassigned = Unassigned;

  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;
  @ViewChild("cipherAddEdit", { read: ViewContainerRef, static: true })
  cipherAddEditModalRef: ViewContainerRef;
  @ViewChild("collectionsModal", { read: ViewContainerRef, static: true })
  collectionsModalRef: ViewContainerRef;

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
  /**
   * Used to show an old missing permission message for custom users with DeleteAnyCollection
   * @deprecated Replaced with showCollectionAccessRestricted$ and this should be removed after flexible collections V1
   * is released
   */
  protected showMissingCollectionPermissionMessage: boolean;
  protected showCollectionAccessRestricted: boolean;
  protected currentSearchText$: Observable<string>;
  /**
   * A list of collections that the user can assign items to and edit those items within.
   * @protected
   */
  protected editableCollections$: Observable<CollectionAdminView[]>;
  protected allCollectionsWithoutUnassigned$: Observable<CollectionAdminView[]>;
  private _flexibleCollectionsV1FlagEnabled: boolean;

  protected get flexibleCollectionsV1Enabled(): boolean {
    return this._flexibleCollectionsV1FlagEnabled;
  }
  protected orgRevokedUsers: OrganizationUserUserDetailsResponse[];

  private _restrictProviderAccessFlagEnabled: boolean;
  protected get restrictProviderAccessEnabled(): boolean {
    return this._restrictProviderAccessFlagEnabled && this.flexibleCollectionsV1Enabled;
  }

  protected get hideVaultFilters(): boolean {
    return (
      this.restrictProviderAccessEnabled &&
      this.organization?.isProviderUser &&
      !this.organization?.isMember
    );
  }

  private searchText$ = new Subject<string>();
  private refresh$ = new BehaviorSubject<void>(null);
  private destroy$ = new Subject<void>();
  protected addAccessStatus$ = new BehaviorSubject<AddAccessStatusType>(0);

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
    private modalService: ModalService,
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
    private groupService: GroupService,
    private logService: LogService,
    private eventCollectionService: EventCollectionService,
    private totpService: TotpService,
    private apiService: ApiService,
    private collectionService: CollectionService,
    private organizationUserService: OrganizationUserService,
    protected configService: ConfigService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning",
    );

    this._flexibleCollectionsV1FlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.FlexibleCollectionsV1,
    );

    this._restrictProviderAccessFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.RestrictProviderAccess,
    );

    const filter$ = this.routedVaultFilterService.filter$;
    const organizationId$ = filter$.pipe(
      map((filter) => filter.organizationId),
      filter((filter) => filter !== undefined),
      distinctUntilChanged(),
    );

    const organization$ = organizationId$.pipe(
      switchMap((organizationId) => this.organizationService.get$(organizationId)),
      takeUntil(this.destroy$),
      shareReplay({ refCount: false, bufferSize: 1 }),
    );

    const firstSetup$ = combineLatest([organization$, this.route.queryParams]).pipe(
      first(),
      switchMap(async ([organization]) => {
        this.organization = organization;

        if (!organization.canEditAnyCollection(this.flexibleCollectionsV1Enabled)) {
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

    this.allCollectionsWithoutUnassigned$ = combineLatest([
      organizationId$.pipe(switchMap((orgId) => this.collectionAdminService.getAll(orgId))),
      defer(() => this.collectionService.getAllDecrypted()),
    ]).pipe(
      map(([adminCollections, syncCollections]) => {
        const syncCollectionDict = Object.fromEntries(syncCollections.map((c) => [c.id, c]));

        return adminCollections.map((collection) => {
          const currentId: any = collection.id;

          const match = syncCollectionDict[currentId];

          if (match) {
            collection.manage = match.manage;
            collection.readOnly = match.readOnly;
            collection.hidePasswords = match.hidePasswords;
          }
          return collection;
        });
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.editableCollections$ = this.allCollectionsWithoutUnassigned$.pipe(
      map((collections) => {
        // Users that can edit all ciphers can implicitly add to / edit within any collection
        if (
          this.organization.canEditAllCiphers(
            this.flexibleCollectionsV1Enabled,
            this.restrictProviderAccessEnabled,
          )
        ) {
          return collections;
        }
        // The user is only allowed to add/edit items to assigned collections that are not readonly
        return collections.filter((c) => c.assigned && !c.readOnly);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const allCollections$ = combineLatest([
      organizationId$,
      this.allCollectionsWithoutUnassigned$,
    ]).pipe(
      map(([organizationId, allCollections]) => {
        const noneCollection = new CollectionAdminView();
        noneCollection.name = this.i18nService.t("unassigned");
        noneCollection.id = Unassigned;
        noneCollection.organizationId = organizationId;
        return allCollections.concat(noneCollection);
      }),
    );

    const allGroups$ = organizationId$.pipe(
      switchMap((organizationId) => this.groupService.getAll(organizationId)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const allCiphers$ = organization$.pipe(
      concatMap(async (organization) => {
        // If user swaps organization reset the addAccessToggle
        if (!this.showAddAccessToggle || organization) {
          this.addAccessToggle(0);
        }
        let ciphers;

        // Restricted providers (who are not members) do not have access org cipher endpoint below
        // Return early to avoid 404 response
        if (
          this.restrictProviderAccessEnabled &&
          !organization.isMember &&
          organization.isProviderUser
        ) {
          return [];
        }

        if (this.flexibleCollectionsV1Enabled) {
          // Flexible collections V1 logic.
          // If the user can edit all ciphers for the organization then fetch them ALL.
          if (
            organization.canEditAllCiphers(
              this.flexibleCollectionsV1Enabled,
              this.restrictProviderAccessEnabled,
            )
          ) {
            ciphers = await this.cipherService.getAllFromApiForOrganization(organization.id);
          } else {
            // Otherwise, only fetch ciphers they have access to (includes unassigned for admins).
            ciphers = await this.cipherService.getManyFromApiForOrganization(organization.id);
          }
        } else {
          // Pre-flexible collections logic, to be removed after flexible collections is fully released
          if (
            organization.canEditAllCiphers(
              this.flexibleCollectionsV1Enabled,
              this.restrictProviderAccessEnabled,
            )
          ) {
            ciphers = await this.cipherService.getAllFromApiForOrganization(organization.id);
          } else {
            ciphers = (await this.cipherService.getAllDecrypted()).filter(
              (c) => c.organizationId === organization.id,
            );
          }
        }

        await this.searchService.indexCiphers(ciphers, organization.id);
        return ciphers;
      }),
    );

    const allCipherMap$ = allCiphers$.pipe(
      map((ciphers) => {
        return Object.fromEntries(ciphers.map((c) => [c.id, c]));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const nestedCollections$ = allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // This will be passed into the usersCanManage call
    this.orgRevokedUsers = (
      await this.organizationUserService.getAllUsers(await firstValueFrom(organizationId$))
    ).data.filter((user: OrganizationUserUserDetailsResponse) => {
      return user.status === -1;
    });

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
        let collectionsToReturn = [];
        if (filter.collectionId === undefined || filter.collectionId === All) {
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
            (collection: CollectionAdminView) => collection.name,
            (collection: CollectionAdminView) => collection.id,
          );
        }

        // Add access toggle is only shown if allowAdminAccessToAllCollectionItems is false and there are unmanaged collections the user can edit
        this.showAddAccessToggle =
          this.flexibleCollectionsV1Enabled &&
          !this.organization.allowAdminAccessToAllCollectionItems &&
          this.organization.canEditUnmanagedCollections() &&
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
          (filter.collectionId === Unassigned &&
            !organization.canEditUnassignedCiphers(this.restrictProviderAccessEnabled)) ||
          (!organization.canEditAllCiphers(
            this.flexibleCollectionsV1Enabled,
            this.restrictProviderAccessEnabled,
          ) &&
            collection != undefined &&
            !collection.node.assigned)
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

        if (this.flexibleCollectionsV1Enabled && showCollectionAccessRestricted) {
          // Do not show ciphers for restricted collections
          // Ciphers belonging to multiple collections may still be present in $allCiphers and shouldn't be visible
          return [];
        }

        const filterFunction = createFilterFunction(filter);

        if (await this.searchService.isSearchable(searchText)) {
          return await this.searchService.searchCiphers(searchText, [filterFunction], ciphers);
        }

        return ciphers.filter(filterFunction);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const showMissingCollectionPermissionMessage$ = combineLatest([
      filter$,
      selectedCollection$,
      organization$,
    ]).pipe(
      map(([filter, collection, organization]) => {
        return (
          // Filtering by unassigned, show message if not admin
          (filter.collectionId === Unassigned &&
            !organization.canEditUnassignedCiphers(this.restrictProviderAccessEnabled)) ||
          // Filtering by a collection, so show message if user is not assigned
          (collection != undefined &&
            !collection.node.assigned &&
            !organization.canEditAnyCollection(this.flexibleCollectionsV1Enabled))
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    firstSetup$
      .pipe(
        switchMap(() => combineLatest([this.route.queryParams, organization$])),
        switchMap(async ([qParams, organization]) => {
          const cipherId = getCipherIdFromParams(qParams);
          if (!cipherId) {
            return;
          }

          let canEditCipher: boolean;

          if (this.flexibleCollectionsV1Enabled) {
            canEditCipher =
              organization.canEditAllCiphers(true, this.restrictProviderAccessEnabled) ||
              (await firstValueFrom(allCipherMap$))[cipherId] != undefined;
          } else {
            canEditCipher =
              organization.canEditAnyCollection(this.flexibleCollectionsV1Enabled) ||
              (await this.cipherService.get(cipherId)) != null;
          }

          if (canEditCipher) {
            await this.editCipherId(cipherId);
          } else {
            this.platformUtilsService.showToast("error", null, this.i18nService.t("unknownCipher"));
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
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.viewEvents(cipher);
          } else {
            this.platformUtilsService.showToast("error", null, this.i18nService.t("unknownCipher"));
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate([], {
              queryParams: { viewEvents: null },
              queryParamsHandling: "merge",
            });
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

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
            showMissingCollectionPermissionMessage$,
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
          showMissingCollectionPermissionMessage,
          showCollectionAccessRestricted,
        ]) => {
          this.organization = organization;
          this.filter = filter;
          this.allCollections = allCollections;
          this.allGroups = allGroups;
          this.ciphers = ciphers;
          this.collections = collections;
          this.selectedCollection = selectedCollection;
          this.showMissingCollectionPermissionMessage = showMissingCollectionPermissionMessage;
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

  async onVaultItemsEvent(event: VaultItemEvent) {
    this.processingEvent = true;

    try {
      if (event.type === "viewAttachments") {
        await this.editCipherAttachments(event.item);
      } else if (event.type === "viewCipherCollections") {
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
      } else if (event.type === "copyField") {
        await this.copy(event.item, event.field);
      } else if (event.type === "editCollection") {
        await this.editCollection(
          event.item as CollectionAdminView,
          CollectionDialogTabType.Info,
          event.readonly,
        );
      } else if (event.type === "viewCollectionAccess") {
        await this.editCollection(
          event.item as CollectionAdminView,
          CollectionDialogTabType.Access,
          event.readonly,
        );
      } else if (event.type === "bulkEditCollectionAccess") {
        await this.bulkEditCollectionAccess(event.items, this.organization);
      } else if (event.type === "assignToCollections") {
        await this.bulkAssignToCollections(event.items);
      } else if (event.type === "viewEvents") {
        await this.viewEvents(event.item);
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

    let madeAttachmentChanges = false;

    const [modal] = await this.modalService.openViewRef(
      AttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.organization = this.organization;
        comp.cipherId = cipher.id;
        comp.onUploadedAttachment
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => (madeAttachmentChanges = true));
        comp.onDeletedAttachment
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

  async editCipherCollections(cipher: CipherView) {
    let collections: CollectionAdminView[] = [];

    if (this.flexibleCollectionsV1Enabled) {
      // V1 limits admins to only adding items to collections they have access to.
      collections = await firstValueFrom(
        this.allCollectionsWithoutUnassigned$.pipe(
          map((c) => {
            return c.sort((a, b) => {
              if (
                a.canEditItems(this.organization, true, this.restrictProviderAccessEnabled) &&
                !b.canEditItems(this.organization, true, this.restrictProviderAccessEnabled)
              ) {
                return -1;
              } else if (
                !a.canEditItems(this.organization, true, this.restrictProviderAccessEnabled) &&
                b.canEditItems(this.organization, true, this.restrictProviderAccessEnabled)
              ) {
                return 1;
              } else {
                return a.name.localeCompare(b.name);
              }
            });
          }),
        ),
      );
    } else {
      collections = await firstValueFrom(this.allCollectionsWithoutUnassigned$);
    }
    const dialog = openOrgVaultCollectionsDialog(this.dialogService, {
      data: {
        collectionIds: cipher.collectionIds,
        collections: collections,
        organization: this.organization,
        cipherId: cipher.id,
      },
    });

    if ((await lastValueFrom(dialog.closed)) == CollectionsDialogResult.Saved) {
      this.refresh();
    }
  }

  async addCipher() {
    let collections: CollectionView[] = [];

    if (this.flexibleCollectionsV1Enabled) {
      // V1 limits admins to only adding items to collections they have access to.
      collections = await firstValueFrom(this.editableCollections$);
    } else {
      collections = (await firstValueFrom(this.vaultFilterService.filteredCollections$)).filter(
        (c) => !c.readOnly && c.id != Unassigned,
      );
    }

    await this.editCipher(null, (comp) => {
      comp.type = this.activeFilter.cipherType;
      comp.collections = collections;
      if (this.activeFilter.collectionId) {
        comp.collectionIds = [this.activeFilter.collectionId];
      }
    });
  }

  async navigateToCipher(cipher: CipherView) {
    this.go({ itemId: cipher?.id });
  }

  async editCipher(
    cipher: CipherView,
    additionalComponentParameters?: (comp: AddEditComponent) => void,
  ) {
    return this.editCipherId(cipher?.id, additionalComponentParameters);
  }

  async editCipherId(
    cipherId: string,
    additionalComponentParameters?: (comp: AddEditComponent) => void,
  ) {
    const cipher = await this.cipherService.get(cipherId);
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

    const defaultComponentParameters = (comp: AddEditComponent) => {
      comp.organization = this.organization;
      comp.organizationId = this.organization.id;
      comp.cipherId = cipherId;
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
    };

    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.cipherAddEditModalRef,
      additionalComponentParameters == null
        ? defaultComponentParameters
        : (comp) => {
            defaultComponentParameters(comp);
            additionalComponentParameters(comp);
          },
    );

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    modal.onClosedPromise().then(() => {
      this.go({ cipherId: null, itemId: null });
    });

    return childComponent;
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

    let collections: CollectionView[] = [];

    if (this.flexibleCollectionsV1Enabled) {
      // V1 limits admins to only adding items to collections they have access to.
      collections = await firstValueFrom(this.editableCollections$);
    } else {
      collections = (await firstValueFrom(this.vaultFilterService.filteredCollections$)).filter(
        (c) => !c.readOnly && c.id != Unassigned,
      );
    }

    await this.editCipher(cipher, (comp) => {
      comp.cloneMode = true;
      comp.collections = collections;
      comp.collectionIds = cipher.collectionIds;
    });
  }

  async restore(c: CipherView): Promise<boolean> {
    if (!c.isDeleted) {
      return;
    }

    if (
      !this.organization.permissions.editAnyCollection &&
      this.flexibleCollectionsV1Enabled &&
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
      const asAdmin =
        this.organization?.canEditAnyCollection(this.flexibleCollectionsV1Enabled) ||
        c.isUnassigned;
      await this.cipherService.restoreWithServer(c.id, asAdmin);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItem"));
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkRestore(ciphers: CipherView[]) {
    if (
      !this.organization.permissions.editAnyCollection &&
      this.flexibleCollectionsV1Enabled &&
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
    const canEditAll = this.organization.canEditAllCiphers(
      this.flexibleCollectionsV1Enabled,
      this.restrictProviderAccessEnabled,
    );

    if (canEditAll) {
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
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected"),
      );
      return;
    }

    if (unassignedCiphers.length > 0 || editAccessCiphers.length > 0) {
      await this.cipherService.restoreManyWithServer(
        [...unassignedCiphers, ...editAccessCiphers],
        this.organization.id,
      );
    }

    this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItems"));
    this.refresh();
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
    if (
      this.flexibleCollectionsV1Enabled &&
      !c.edit &&
      !this.organization.canEditAllCiphers(
        this.flexibleCollectionsV1Enabled,
        this.restrictProviderAccessEnabled,
      )
    ) {
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
      await this.deleteCipherWithServer(c.id, permanent, c.isUnassigned);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem"),
      );
      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async deleteCollection(collection: CollectionAdminView): Promise<void> {
    if (!collection.canDelete(this.organization, this.flexibleCollectionsV1Enabled)) {
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
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedCollectionId", collection.name),
      );

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
      this.platformUtilsService.showToast("error", null, this.i18nService.t("nothingSelected"));
      return;
    }

    const canDeleteCollections =
      collections == null ||
      collections.every((c) => c.canDelete(organization, this.flexibleCollectionsV1Enabled));
    const canDeleteCiphers =
      ciphers == null ||
      ciphers.every((c) => c.edit) ||
      this.organization.canEditAllCiphers(
        this.flexibleCollectionsV1Enabled,
        this.restrictProviderAccessEnabled,
      );

    if (this.flexibleCollectionsV1Enabled && (!canDeleteCiphers || !canDeleteCollections)) {
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
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    );

    if (field === "password") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (field === "totp") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedHiddenField, cipher.id);
    }
  }

  async addCollection(): Promise<void> {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: this.organization?.id,
        parentCollectionId: this.selectedCollection?.node.id,
        limitNestedCollections: !this.organization.canEditAnyCollection(
          this.flexibleCollectionsV1Enabled,
        ),
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
        limitNestedCollections: !this.organization.canEditAnyCollection(
          this.flexibleCollectionsV1Enabled,
        ),
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

    if (
      this.flexibleCollectionsV1Enabled &&
      collections.some((c) => !c.canEdit(organization, this.flexibleCollectionsV1Enabled))
    ) {
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
      this.platformUtilsService.showToast("error", null, this.i18nService.t("nothingSelected"));
      return;
    }

    let availableCollections: CollectionView[];

    if (this.flexibleCollectionsV1Enabled) {
      availableCollections = await firstValueFrom(this.editableCollections$);
    } else {
      availableCollections = (
        await firstValueFrom(this.vaultFilterService.filteredCollections$)
      ).filter((c) => c.id != Unassigned);
    }

    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers: items,
        organizationId: this.organization?.id as OrganizationId,
        availableCollections,
        activeCollection: this.activeFilter?.selectedCollectionNode?.node,
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

  protected deleteCipherWithServer(id: string, permanent: boolean, isUnassigned: boolean) {
    const asAdmin =
      this.organization?.canEditAllCiphers(
        this.flexibleCollectionsV1Enabled,
        this.restrictProviderAccessEnabled,
      ) || isUnassigned;
    return permanent
      ? this.cipherService.deleteWithServer(id, asAdmin)
      : this.cipherService.softDeleteWithServer(id, asAdmin);
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
        type: this.activeFilter.cipherType,
        collectionId: this.activeFilter.collectionId,
        deleted: this.activeFilter.isDeleted || null,
      };
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([], {
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
