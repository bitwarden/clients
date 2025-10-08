import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, Subject, takeUntil, switchMap, lastValueFrom, Observable } from "rxjs";
import { filter, map, take } from "rxjs/operators";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getByIds } from "@bitwarden/common/platform/misc";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType, toCipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogResult,
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
} from "@bitwarden/vault";

import { NavComponent } from "../../../app/layout/nav.component";
import { SearchBarService } from "../../../app/layout/search/search-bar.service";
import { DesktopCredentialGenerationService } from "../../../services/desktop-cipher-form-generator.service";
import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { invokeMenu, RendererMenuItem } from "../../../utils";

import { AssignCollectionsDesktopComponent } from "./assign-collections";
import { ItemFooterComponent } from "./item-footer.component";
import { VaultFilterComponent } from "./vault-filter/vault-filter.component";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultItemsV2Component } from "./vault-items-v2.component";

const BroadcasterSubscriptionId = "VaultComponent";

@Component({
  selector: "app-vault",
  templateUrl: "vault-v2.component.html",
  imports: [
    BadgeModule,
    CommonModule,
    CipherFormModule,
    CipherViewComponent,
    ItemFooterComponent,
    I18nPipe,
    ItemModule,
    ButtonModule,
    PremiumBadgeComponent,
    NavComponent,
    VaultFilterModule,
    VaultItemsV2Component,
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
      useExisting: VaultV2Component,
    },
  ],
})
export class VaultV2Component<C extends CipherViewLike>
  implements OnInit, OnDestroy, CopyClickListener
{
  @ViewChild(VaultItemsV2Component, { static: true })
  vaultItemsComponent: VaultItemsV2Component<C> | null = null;
  @ViewChild(VaultFilterComponent, { static: true })
  vaultFilterComponent: VaultFilterComponent | null = null;
  @ViewChild("folderAddEdit", { read: ViewContainerRef, static: true })
  folderAddEditModalRef: ViewContainerRef | null = null;
  @ViewChild(CipherFormComponent)
  cipherFormComponent: CipherFormComponent | null = null;

  action: CipherFormMode | "view" | null = null;
  cipherId: string | null = null;
  favorites = false;
  type: CipherType | null = null;
  folderId: string | null = null;
  collectionId: string | null = null;
  organizationId: string | null = null;
  myVaultOnly = false;
  addType: CipherType | undefined = undefined;
  addOrganizationId: string | null = null;
  addCollectionIds: string[] | null = null;
  showingModal = false;
  deleted = false;
  userHasPremiumAccess = false;
  activeFilter: VaultFilter = new VaultFilter();
  activeUserId: UserId | null = null;
  cipherRepromptId: string | null = null;
  cipher: CipherView | null = new CipherView();
  collections: CollectionView[] | null = null;
  config: CipherFormConfig | null = null;

  /** Tracks the disabled status of the edit cipher form */
  protected formDisabled: boolean = false;

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

  private componentIsDestroyed$ = new Subject<boolean>();
  private allOrganizations: Organization[] = [];
  private allCollections: CollectionView[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private i18nService: I18nService,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private syncService: SyncService,
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private eventCollectionService: EventCollectionService,
    private totpService: TotpService,
    private passwordRepromptService: PasswordRepromptService,
    private searchBarService: SearchBarService,
    private apiService: ApiService,
    private dialogService: DialogService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
    private accountService: AccountService,
    private cipherService: CipherService,
    private formConfigService: CipherFormConfigService,
    private premiumUpgradePromptService: PremiumUpgradePromptService,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private folderService: FolderService,
    private configService: ConfigService,
    private authRequestService: AuthRequestServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        filter((account): account is Account => !!account),
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntil(this.componentIsDestroyed$),
      )
      .subscribe((canAccessPremium: boolean) => {
        this.userHasPremiumAccess = canAccessPremium;
      });

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone
        .run(async () => {
          let detectChanges = true;
          try {
            switch (message.command) {
              case "newLogin":
                await this.addCipher(CipherType.Login).catch(() => {});
                break;
              case "newCard":
                await this.addCipher(CipherType.Card).catch(() => {});
                break;
              case "newIdentity":
                await this.addCipher(CipherType.Identity).catch(() => {});
                break;
              case "newSecureNote":
                await this.addCipher(CipherType.SecureNote).catch(() => {});
                break;
              case "newSshKey":
                await this.addCipher(CipherType.SshKey).catch(() => {});
                break;
              case "focusSearch":
                (document.querySelector("#search") as HTMLInputElement)?.select();
                detectChanges = false;
                break;
              case "syncCompleted":
                if (this.vaultItemsComponent) {
                  await this.vaultItemsComponent
                    .reload(this.activeFilter.buildFilter())
                    .catch(() => {});
                }
                if (this.vaultFilterComponent) {
                  await this.vaultFilterComponent
                    .reloadCollectionsAndFolders(this.activeFilter)
                    .catch(() => {});
                  await this.vaultFilterComponent.reloadOrganizations().catch(() => {});
                }
                break;
              case "modalShown":
                this.showingModal = true;
                break;
              case "modalClosed":
                this.showingModal = false;
                break;
              case "copyUsername": {
                if (this.cipher?.login?.username) {
                  this.copyValue(this.cipher, this.cipher?.login?.username, "username", "Username");
                }
                break;
              }
              case "copyPassword": {
                if (this.cipher?.login?.password && this.cipher.viewPassword) {
                  this.copyValue(this.cipher, this.cipher.login.password, "password", "Password");
                  await this.eventCollectionService
                    .collect(EventType.Cipher_ClientCopiedPassword, this.cipher.id)
                    .catch(() => {});
                }
                break;
              }
              case "copyTotp": {
                if (
                  this.cipher?.login?.hasTotp &&
                  (this.cipher.organizationUseTotp || this.userHasPremiumAccess)
                ) {
                  const value = await firstValueFrom(
                    this.totpService.getCode$(this.cipher.login.totp),
                  ).catch((): any => null);
                  if (value) {
                    this.copyValue(this.cipher, value.code, "verificationCodeTotp", "TOTP");
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
        })
        .catch(() => {});
    });

    if (!this.syncService.syncInProgress) {
      await this.load().catch(() => {});
    }

    this.searchBarService.setEnabled(true);
    this.searchBarService.setPlaceholderText(this.i18nService.t("searchVault"));

    const authRequests = await firstValueFrom(
      this.authRequestService.getLatestPendingAuthRequest$()!,
    );
    if (authRequests != null) {
      this.messagingService.send("openLoginApproval", {
        notificationId: authRequests.id,
      });
    }

    this.activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getUserId),
    ).catch((): any => null);

    if (this.activeUserId) {
      this.cipherService
        .failedToDecryptCiphers$(this.activeUserId)
        .pipe(
          map((ciphers) => ciphers?.filter((c) => !c.isDeleted) ?? []),
          filter((ciphers) => ciphers.length > 0),
          take(1),
          takeUntil(this.componentIsDestroyed$),
        )
        .subscribe((ciphers) => {
          DecryptionFailureDialogComponent.open(this.dialogService, {
            cipherIds: ciphers.map((c) => c.id as CipherId),
          });
        });
    }

    this.organizations$.pipe(takeUntil(this.componentIsDestroyed$)).subscribe((orgs) => {
      this.allOrganizations = orgs;
    });

    if (!this.activeUserId) {
      throw new Error("No user found.");
    }

    this.collectionService
      .decryptedCollections$(this.activeUserId)
      .pipe(takeUntil(this.componentIsDestroyed$))
      .subscribe((collections) => {
        this.allCollections = collections;
      });
  }

  ngOnDestroy() {
    this.searchBarService.setEnabled(false);
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.componentIsDestroyed$.next(true);
    this.componentIsDestroyed$.complete();
  }

  async load() {
    const params = await firstValueFrom(this.route.queryParams).catch();
    const paramCipherAddType = toCipherType(params.addType);
    if (params.cipherId) {
      const cipherView = new CipherView();
      cipherView.id = params.cipherId;
      if (params.action === "clone") {
        await this.cloneCipher(cipherView).catch(() => {});
      } else if (params.action === "edit") {
        await this.editCipher(cipherView).catch(() => {});
      } else {
        await this.viewCipher(cipherView).catch(() => {});
      }
    } else if (params.action === "add" && paramCipherAddType) {
      this.addType = paramCipherAddType;
      await this.addCipher(this.addType).catch(() => {});
    }

    const paramCipherType = toCipherType(params.type);
    this.activeFilter = new VaultFilter({
      status: params.deleted ? "trash" : params.favorites ? "favorites" : "all",
      cipherType: params.action === "add" || paramCipherType == null ? undefined : paramCipherType,
      selectedFolderId: params.folderId,
      selectedCollectionId: params.selectedCollectionId,
      selectedOrganizationId: params.selectedOrganizationId,
      myVaultOnly: params.myVaultOnly ?? false,
    });
    if (this.vaultItemsComponent) {
      await this.vaultItemsComponent.reload(this.activeFilter.buildFilter()).catch(() => {});
    }
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
    this.cipher = cipher;
    this.collections =
      this.vaultFilterComponent?.collections?.fullList.filter((c) =>
        cipher.collectionIds.includes(c.id),
      ) ?? null;
    this.action = "view";

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

  async openAttachmentsDialog() {
    if (!this.userHasPremiumAccess) {
      return;
    }
    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: this.cipherId as CipherId,
    });
    const result = await firstValueFrom(dialogRef.closed).catch((): any => null);
    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      await this.vaultItemsComponent?.refresh().catch(() => {});

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

  async viewCipherMenu(c: CipherViewLike) {
    const cipher = await this.cipherService.getFullCipherView(c);
    const menu: RendererMenuItem[] = [
      {
        label: this.i18nService.t("view"),
        click: () => {
          this.functionWithChangeDetection(() => {
            this.viewCipher(cipher).catch(() => {});
          });
        },
      },
    ];

    if (cipher.decryptionFailure) {
      invokeMenu(menu);
    }

    if (!cipher.isDeleted) {
      menu.push({
        label: this.i18nService.t("edit"),
        click: () => {
          this.functionWithChangeDetection(() => {
            this.editCipher(cipher).catch(() => {});
          });
        },
      });
      if (!cipher.organizationId) {
        menu.push({
          label: this.i18nService.t("clone"),
          click: () => {
            this.functionWithChangeDetection(() => {
              this.cloneCipher(cipher).catch(() => {});
            });
          },
        });
      }

      const hasEditableCollections = this.allCollections.some((collection) => !collection.readOnly);

      if (cipher.canAssignToCollections && hasEditableCollections) {
        menu.push({
          label: this.i18nService.t("assignToCollections"),
          click: () =>
            this.functionWithChangeDetection(async () => {
              await this.shareCipher(cipher);
            }),
        });
      }
    }

    switch (cipher.type) {
      case CipherType.Login:
        if (
          cipher.login.canLaunch ||
          cipher.login.username != null ||
          cipher.login.password != null
        ) {
          menu.push({ type: "separator" });
        }
        if (cipher.login.canLaunch) {
          menu.push({
            label: this.i18nService.t("launch"),
            click: () => this.platformUtilsService.launchUri(cipher.login.launchUri),
          });
        }
        if (cipher.login.username != null) {
          menu.push({
            label: this.i18nService.t("copyUsername"),
            click: () => this.copyValue(cipher, cipher.login.username, "username", "Username"),
          });
        }
        if (cipher.login.password != null && cipher.viewPassword) {
          menu.push({
            label: this.i18nService.t("copyPassword"),
            click: () => {
              this.copyValue(cipher, cipher.login.password, "password", "Password");
              this.eventCollectionService
                .collect(EventType.Cipher_ClientCopiedPassword, cipher.id)
                .catch(() => {});
            },
          });
        }
        if (cipher.login.hasTotp && (cipher.organizationUseTotp || this.userHasPremiumAccess)) {
          menu.push({
            label: this.i18nService.t("copyVerificationCodeTotp"),
            click: async () => {
              const value = await firstValueFrom(
                this.totpService.getCode$(cipher.login.totp),
              ).catch((): any => null);
              if (value) {
                this.copyValue(cipher, value.code, "verificationCodeTotp", "TOTP");
              }
            },
          });
        }
        break;
      case CipherType.Card:
        if (cipher.card.number != null || cipher.card.code != null) {
          menu.push({ type: "separator" });
        }
        if (cipher.card.number != null) {
          menu.push({
            label: this.i18nService.t("copyNumber"),
            click: () => this.copyValue(cipher, cipher.card.number, "number", "Card Number"),
          });
        }
        if (cipher.card.code != null) {
          menu.push({
            label: this.i18nService.t("copySecurityCode"),
            click: () => {
              this.copyValue(cipher, cipher.card.code, "securityCode", "Security Code");
              this.eventCollectionService
                .collect(EventType.Cipher_ClientCopiedCardCode, cipher.id)
                .catch(() => {});
            },
          });
        }
        break;
      default:
        break;
    }
    invokeMenu(menu);
  }

  async shouldReprompt(cipher: CipherView, action: "edit" | "clone" | "view"): Promise<boolean> {
    return !(await this.canNavigateAway(action, cipher)) || !(await this.passwordReprompt(cipher));
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
    this.cipher = cipher;
    await this.buildFormConfig("edit");
    if (!cipher.edit && this.config) {
      this.config.mode = "partial-edit";
    }
    this.action = "edit";
    await this.go().catch(() => {});
  }

  async cloneCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "clone")) {
      return;
    }
    this.cipherId = cipher.id;
    this.cipher = cipher;
    await this.buildFormConfig("clone");
    this.action = "clone";
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
    if (this.action === "add") {
      return;
    }
    this.addType = type || this.activeFilter.cipherType;
    this.cipher = new CipherView();
    this.cipherId = null;
    await this.buildFormConfig("add");
    this.action = "add";
    this.prefillCipherFromFilter();
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
    this.action = "view";
    await this.vaultItemsComponent?.refresh().catch(() => {});

    if (!this.activeUserId) {
      throw new Error("No userId provided.");
    }

    this.collections = await firstValueFrom(
      this.collectionService
        .decryptedCollections$(this.activeUserId)
        .pipe(getByIds(cipher.collectionIds)),
    );

    this.cipherId = cipher.id;
    this.cipher = cipher;
    if (this.activeUserId) {
      await this.cipherService.clearCache(this.activeUserId).catch(() => {});
    }
    await this.vaultItemsComponent?.load(this.activeFilter.buildFilter()).catch(() => {});
    await this.go().catch(() => {});
    await this.vaultItemsComponent?.refresh().catch(() => {});
  }

  async deleteCipher() {
    this.cipherId = null;
    this.cipher = null;
    this.action = null;
    await this.go().catch(() => {});
    await this.vaultItemsComponent?.refresh().catch(() => {});
  }

  async restoreCipher() {
    this.cipherId = null;
    this.action = null;
    await this.go().catch(() => {});
    await this.vaultItemsComponent?.refresh().catch(() => {});
  }

  async cancelCipher(cipher: CipherView) {
    this.cipherId = cipher.id;
    this.cipher = cipher;
    this.action = this.cipherId != null ? "view" : null;
    await this.go().catch(() => {});
  }

  async applyVaultFilter(vaultFilter: VaultFilter) {
    this.searchBarService.setPlaceholderText(
      this.i18nService.t(this.calculateSearchBarLocalizationString(vaultFilter)),
    );
    this.activeFilter = vaultFilter;
    await this.vaultItemsComponent
      ?.reload(this.activeFilter.buildFilter(), vaultFilter.status === "trash")
      .catch(() => {});
    await this.go().catch(() => {});
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
    if (vaultFilter.status === "favorites") {
      return "searchFavorites";
    }
    if (vaultFilter.status === "trash") {
      return "searchTrash";
    }
    if (vaultFilter.cipherType != null) {
      return "searchType";
    }
    if (vaultFilter.selectedFolderId != null && vaultFilter.selectedFolderId !== "none") {
      return "searchFolder";
    }
    if (vaultFilter.selectedCollectionId != null) {
      return "searchCollection";
    }
    if (vaultFilter.selectedOrganizationId != null) {
      return "searchOrganization";
    }
    if (vaultFilter.myVaultOnly) {
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

    const dialogRef = AddEditFolderDialogComponent.open(this.dialogService, {
      editFolderConfig: {
        folder: {
          ...folderView,
        },
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (
      result === AddEditFolderDialogResult.Deleted ||
      result === AddEditFolderDialogResult.Created
    ) {
      await this.vaultFilterComponent?.reloadCollectionsAndFolders(this.activeFilter);
    }
  }

  private dirtyInput(): boolean {
    return (
      (this.action === "add" || this.action === "edit" || this.action === "clone") &&
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
        action: this.action,
        cipherId: this.cipherId,
        favorites: this.favorites ? true : null,
        type: this.type,
        folderId: this.folderId,
        collectionId: this.collectionId,
        deleted: this.deleted ? true : null,
        organizationId: this.organizationId,
        myVaultOnly: this.myVaultOnly,
      };
    }
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: queryParams,
        replaceUrl: true,
      })
      .catch(() => {});
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

  private prefillCipherFromFilter() {
    if (this.activeFilter.selectedCollectionId != null && this.vaultFilterComponent != null) {
      const collections = this.vaultFilterComponent.collections?.fullList.filter(
        (c) => c.id === this.activeFilter.selectedCollectionId,
      );
      if (collections.length > 0) {
        this.addOrganizationId = collections[0].organizationId;
        this.addCollectionIds = [this.activeFilter.selectedCollectionId];
      }
    } else if (this.activeFilter.selectedOrganizationId) {
      this.addOrganizationId = this.activeFilter.selectedOrganizationId;
    } else {
      // clear out organizationId when the user switches to a personal vault filter
      this.addOrganizationId = null;
    }
    if (this.activeFilter.selectedFolderId && this.activeFilter.selectedFolder) {
      this.folderId = this.activeFilter.selectedFolderId;
    }

    if (this.config == null) {
      return;
    }

    this.config.initialValues = {
      ...this.config.initialValues,
      organizationId: this.addOrganizationId as OrganizationId,
    };
  }

  private async canNavigateAway(action: string, cipher?: CipherView) {
    if (this.action === action && (!cipher || this.cipherId === cipher.id)) {
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
}
