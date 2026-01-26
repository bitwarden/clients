import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from "@angular/core";
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
} from "rxjs";
import { filter, map, take, first, shareReplay, concatMap, tap } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView, Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { getNestedCollectionTree } from "@bitwarden/common/admin-console/utils";
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
import { getByIds } from "@bitwarden/common/platform/misc";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, OrganizationId, UserId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
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
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  AttachmentDialogResult,
  AttachmentsV2Component,
  ChangeLoginPasswordService,
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormGenerationService,
  CipherFormMode,
  CipherFormModule,
  CipherViewComponent,
  CollectionAssignmentResult,
  DecryptionFailureDialogComponent,
  DefaultChangeLoginPasswordService,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  CipherFormComponent,
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
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header/desktop-header.component";
import { DesktopCredentialGenerationService } from "../../../services/desktop-cipher-form-generator.service";
import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { AssignCollectionsDesktopComponent } from "../vault/assign-collections";

import { ItemFooterComponent } from "./cipher-form/item-footer.component";
import { VaultListComponent } from "./vault-list.component";

const BroadcasterSubscriptionId = "VaultComponent";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-v3",
  templateUrl: "vault.component.html",
  imports: [
    BadgeModule,
    CommonModule,
    CipherFormModule,
    CipherViewComponent,
    ItemFooterComponent,
    I18nPipe,
    ItemModule,
    ButtonModule,
    IconButtonModule,
    PremiumBadgeComponent,
    VaultListComponent,
    DesktopHeaderComponent,
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

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(CipherFormComponent)
  protected cipherFormComponent: CipherFormComponent | null = null;
  protected readonly action = signal<CipherFormMode | "view" | null>(null);
  protected cipherId: string | null = null;
  private folderId: string | null | undefined = null;
  private addType: CipherType | undefined = undefined;
  private addOrganizationId: string | null = null;
  private addCollectionIds: string[] | null = null;
  protected activeFilter: VaultFilter = new VaultFilter();
  private activeUserId: UserId | null = null;
  protected cipherRepromptId: string | null = null;
  protected readonly cipher = signal<CipherView | null>(new CipherView());
  protected collections: CollectionView[] | null = null;
  protected config: CipherFormConfig | null = null;

  /** Tracks the disabled status of the edit cipher form */
  protected formDisabled: boolean = false;

  /** Gets the appropriate translation key for the header based on cipher type */
  protected readonly headerTitleKey = computed(() => {
    const currentAction = this.action();
    const currentCipher = this.cipher();

    if (currentAction === "view" && currentCipher) {
      switch (currentCipher.type) {
        case CipherType.Login:
          return "viewLogin";
        case CipherType.Card:
          return "viewCard";
        case CipherType.Identity:
          return "viewIdentity";
        case CipherType.SecureNote:
          return "viewSecureNote";
        case CipherType.SshKey:
          return "viewSshKey";
        default:
          return "viewItem";
      }
    } else if (currentAction === "add") {
      switch (this.addType) {
        case CipherType.Login:
          return "addLogin";
        case CipherType.Card:
          return "addCard";
        case CipherType.Identity:
          return "addIdentity";
        case CipherType.SecureNote:
          return "addSecureNote";
        case CipherType.SshKey:
          return "addSshKey";
        default:
          return "addItem";
      }
    } else if (currentAction === "edit") {
      switch (currentCipher?.type) {
        case CipherType.Login:
          return "editLogin";
        case CipherType.Card:
          return "editCard";
        case CipherType.Identity:
          return "editIdentity";
        case CipherType.SecureNote:
          return "editSecureNote";
        case CipherType.SshKey:
          return "editSshKey";
        default:
          return "editItem";
      }
    } else if (currentAction === "clone") {
      switch (currentCipher?.type) {
        case CipherType.Login:
          return "cloneLogin";
        case CipherType.Card:
          return "cloneCard";
        case CipherType.Identity:
          return "cloneIdentity";
        case CipherType.SecureNote:
          return "cloneSecureNote";
        case CipherType.SshKey:
          return "cloneSshKey";
        default:
          return "cloneItem";
      }
    }
    return "viewItem";
  });

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

  protected performingInitialLoad = true;
  protected refreshing = false;
  protected processingEvent = false;
  protected filter: RoutedVaultFilterModel = {};
  protected canAccessPremium: boolean;
  protected allOrganizations: Organization[] = [];
  protected allCollections: CollectionView[] = [];
  protected filteredCollections: CollectionView[] = [];
  protected collectionsToDisplay: CollectionView[] = [];
  protected selectedCollection: TreeNode<CollectionView> | undefined;
  protected searchPlaceholderText: string;
  private userId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected ciphers: C[] = [];
  protected filteredCiphers: C[] = [];
  protected isEmpty: boolean;
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

  async ngOnInit() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.activeUserId = activeUserId;

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
      this.cipherArchiveService.hasArchiveFlagEnabled$,
    ]).pipe(
      filter(([ciphers, filter]) => ciphers != undefined && filter != undefined),
      concatMap(async ([ciphers, filter, showArchiveVault]) => {
        const failedCiphers =
          (await firstValueFrom(this.cipherService.failedToDecryptCiphers$(activeUserId))) ?? [];
        const filterFunction = createFilterFunction(filter, showArchiveVault);
        // Append any failed to decrypt ciphers to the top of the cipher list
        const allCiphers = [...failedCiphers, ...ciphers];

        return allCiphers.filter(filterFunction) as C[];
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    const collections$ = combineLatest([nestedCollections$, filter$]).pipe(
      filter(([collections, filter]) => collections != undefined && filter != undefined),
      map(([collections, filter]) => {
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
        case "viewAttachments":
          await this.openAttachmentsDialog(event.item.id as CipherId);
          break;
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
              if (!this.userCanArchive$) {
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
    this.cipherId = cipher.id;
    this.cipher.set(cipher);
    this.collections =
      this.filteredCollections?.filter((c) => cipher.collectionIds.includes(c.id)) ?? null;
    this.action.set("view");

    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
    await this.eventCollectionService.collect(
      EventType.Cipher_ClientViewed,
      cipher.id,
      false,
      cipher.organizationId,
    );
  }

  formStatusChanged(status: "disabled" | "enabled") {
    this.formDisabled = status === "disabled";
  }

  async openAttachmentsDialog(cipherId?: CipherId) {
    if (!this.canAccessPremium) {
      return;
    }
    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipherId ?? (this.cipherId as CipherId),
    });
    const result = await firstValueFrom(dialogRef.closed).catch((): any => null);
    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      if (this.cipherFormComponent == null) {
        return;
      }

      // The encrypted state of ciphers is updated when an attachment is added,
      // but the cache is also cleared. Depending on timing, `cipherService.get` can return the
      // old cipher. Retrieve the updated cipher from `cipherViews$`,
      // which refreshes after the cached is cleared.
      const updatedCipherView = await firstValueFrom(
        this.cipherService.cipherViews$(this.activeUserId!).pipe(
          filter((c) => !!c),
          map((ciphers) => ciphers.find((c) => c.id === this.cipherId)),
        ),
      );

      // `find` can return undefined but that shouldn't happen as
      // this would mean that the cipher was deleted.
      // To make TypeScript happy, exit early if it isn't found.
      if (!updatedCipherView) {
        return;
      }

      this.cipherFormComponent.patchCipher((currentCipher) => {
        currentCipher.attachments = updatedCipherView.attachments;
        currentCipher.revisionDate = updatedCipherView.revisionDate;

        return currentCipher;
      });
    }
  }

  async shouldReprompt(cipher: CipherView, action: "edit" | "clone" | "view"): Promise<boolean> {
    return !(await this.canNavigateAway(action, cipher)) || !(await this.passwordReprompt(cipher));
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

  async buildFormConfig(action: CipherFormMode) {
    this.config = await this.formConfigService
      .buildConfig(action, this.cipherId as CipherId, this.addType)
      .catch((): any => null);
  }

  async editCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "edit")) {
      return;
    }
    this.cipherId = cipher.id;
    this.cipher.set(cipher);
    await this.buildFormConfig("edit");
    if (!cipher.edit && this.config) {
      this.config.mode = "partial-edit";
    }
    this.action.set("edit");
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
  }

  async cloneCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "clone")) {
      return;
    }
    this.cipherId = cipher.id;
    this.cipher.set(cipher);
    await this.buildFormConfig("clone");
    this.action.set("clone");
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
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
      const updatedCipher = await firstValueFrom(
        // Fetch the updated cipher from the service
        this.cipherService.cipherViews$(this.activeUserId as UserId).pipe(
          filter((ciphers) => ciphers != null),
          map((ciphers) => ciphers!.find((c) => c.id === cipher.id)),
          filter((foundCipher) => foundCipher != null),
        ),
      );
      await this.savedCipher(updatedCipher);
    }
  }

  async addCipher(type: CipherType) {
    if (this.action() === "add") {
      return;
    }
    this.addType = type || this.activeFilter.cipherType;
    this.cipher.set(new CipherView());
    this.cipherId = null;
    await this.buildFormConfig("add");
    this.action.set("add");
    this.prefillCipherFromFilter();
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});

    if (type === CipherType.SshKey) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("sshKeyGenerated"),
      });
    }
  }

  async savedCipher(cipher: CipherView) {
    this.cipherId = null;
    this.action.set("view");

    if (!this.activeUserId) {
      throw new Error("No userId provided.");
    }

    this.collections = await firstValueFrom(
      this.collectionService
        .decryptedCollections$(this.activeUserId)
        .pipe(getByIds(cipher.collectionIds)),
    );

    this.cipherId = cipher.id;
    this.cipher.set(cipher);
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
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

    this.cipherId = null;
    this.cipher.set(null);
    this.action.set(null);
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
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

    this.cipherId = null;
    this.action.set(null);
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
  };

  async cancelCipher() {
    this.cipherId = null;
    this.cipher.set(null);
    this.action.set(null);
    this.changeDetectorRef.detectChanges();
    await this.go().catch(() => {});
  }

  async handleFavoriteEvent(cipher: C) {
    const cipherFullView = await this.cipherService.getFullCipherView(cipher);
    cipherFullView.favorite = !cipherFullView.favorite;
    const encryptedCipher = await this.cipherService.encrypt(cipherFullView, this.activeUserId);
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

  /** Trigger a refresh of the vault data */
  private refresh() {
    this.refresh$.next();
  }

  /** Refresh the current cipher object */
  protected async refreshCurrentCipher() {
    if (!this.cipher()) {
      return;
    }

    this.cipher.set(
      await firstValueFrom(
        this.cipherService.cipherViews$(this.activeUserId!).pipe(
          filter((c) => !!c),
          map((ciphers) => ciphers.find((c) => c.id === this.cipherId) ?? null),
        ),
      ),
    );
  }

  private dirtyInput(): boolean {
    const currentAction = this.action();
    return (
      (currentAction === "add" || currentAction === "edit" || currentAction === "clone") &&
      document.querySelectorAll("vault-cipher-form .ng-dirty").length > 0
    );
  }

  private async wantsToSaveChanges(): Promise<boolean> {
    const confirmed = await this.dialogService
      .openSimpleDialog({
        title: { key: "unsavedChangesTitle" },
        content: { key: "unsavedChangesConfirmation" },
        type: "warning",
      })
      .catch(() => false);
    return !confirmed;
  }

  private async go(queryParams: any = null) {
    if (queryParams == null) {
      queryParams = {
        action: this.action(),
        itemId: this.cipherId,
      };
    }
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: queryParams,
        queryParamsHandling: "merge",
        replaceUrl: true,
      })
      .catch(() => {});
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

  private prefillCipherFromFilter() {
    if (this.activeFilter.collectionId != null) {
      const collections = this.filteredCollections?.filter(
        (c) => c.id === this.activeFilter.collectionId,
      );
      if (collections?.length > 0) {
        this.addOrganizationId = collections[0].organizationId;
        this.addCollectionIds = [this.activeFilter.collectionId];
      }
    } else if (this.activeFilter.organizationId) {
      this.addOrganizationId = this.activeFilter.organizationId;
    } else {
      // clear out organizationId when the user switches to a personal vault filter
      this.addOrganizationId = null;
    }
    if (this.activeFilter.folderId && this.activeFilter.selectedFolderNode) {
      this.folderId = this.activeFilter.folderId;
    }

    if (this.config == null) {
      return;
    }

    this.config.initialValues = {
      ...this.config.initialValues,
      folderId: this.folderId,
      organizationId: this.addOrganizationId as OrganizationId,
      collectionIds: this.addCollectionIds as CollectionId[],
    };
  }

  private async canNavigateAway(action: string, cipher?: CipherView) {
    if (this.action() === action && (!cipher || this.cipherId === cipher.id)) {
      return false;
    } else if (this.dirtyInput() && (await this.wantsToSaveChanges())) {
      return false;
    }
    return true;
  }

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
