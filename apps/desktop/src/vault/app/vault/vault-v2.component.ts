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
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, Subject, takeUntil, switchMap } from "rxjs";
import { filter, map, take } from "rxjs/operators";

import { CollectionView } from "@bitwarden/admin-console/common";
import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  ItemModule,
  ToastService,
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
  DecryptionFailureDialogComponent,
  DefaultChangeLoginPasswordService,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { NavComponent } from "../../../app/layout/nav.component";
import { SearchBarService } from "../../../app/layout/search/search-bar.service";
import { DesktopCredentialGenerationService } from "../../../services/desktop-cipher-form-generator.service";
import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { invokeMenu, RendererMenuItem } from "../../../utils";

import { FolderAddEditComponent } from "./folder-add-edit.component";
import { ItemFooterComponent } from "./item-footer.component";
import { VaultFilterComponent } from "./vault-filter/vault-filter.component";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultItemsV2Component } from "./vault-items-v2.component";

const BroadcasterSubscriptionId = "VaultComponent";

@Component({
  selector: "app-vault",
  templateUrl: "vault-v2.component.html",
  standalone: true,
  imports: [
    BadgeModule,
    CommonModule,
    CipherFormModule,
    CipherViewComponent,
    ItemFooterComponent,
    I18nPipe,
    ItemModule,
    ButtonModule,
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
  ],
})
export class VaultV2Component implements OnInit, OnDestroy {
  @ViewChild(VaultItemsV2Component, { static: true })
  vaultItemsComponent: VaultItemsV2Component | null = null;
  @ViewChild(VaultFilterComponent, { static: true })
  vaultFilterComponent: VaultFilterComponent | null = null;
  @ViewChild("folderAddEdit", { read: ViewContainerRef, static: true })
  folderAddEditModalRef: ViewContainerRef | null = null;

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

  protected canAccessAttachments$ = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => !!account),
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );

  private modal: ModalRef | null = null;
  private componentIsDestroyed$ = new Subject<boolean>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private i18nService: I18nService,
    private modalService: ModalService,
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
                  ).catch(() => null);
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

    const authRequest = await this.apiService.getLastAuthRequest().catch(() => null);
    if (authRequest != null) {
      this.messagingService.send("openLoginApproval", {
        notificationId: authRequest.id,
      });
    }

    this.activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getUserId),
    ).catch(() => null);

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
  }

  ngOnDestroy() {
    this.searchBarService.setEnabled(false);
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.componentIsDestroyed$.next(true);
    this.componentIsDestroyed$.complete();
  }

  async load() {
    const params = await firstValueFrom(this.route.queryParams).catch();
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
    } else if (params.action === "add") {
      this.addType = Number(params.addType);
      await this.addCipher(this.addType).catch(() => {});
    }

    this.activeFilter = new VaultFilter({
      status: params.deleted ? "trash" : params.favorites ? "favorites" : "all",
      cipherType:
        params.action === "add" || params.type == null
          ? undefined
          : (parseInt(params.type) as CipherType),
      selectedFolderId: params.folderId,
      selectedCollectionId: params.selectedCollectionId,
      selectedOrganizationId: params.selectedOrganizationId,
      myVaultOnly: params.myVaultOnly ?? false,
    });
    if (this.vaultItemsComponent) {
      await this.vaultItemsComponent.reload(this.activeFilter.buildFilter()).catch(() => {});
    }
  }

  async viewCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "view")) {
      return;
    }
    this.cipherId = cipher.id;
    this.cipher = cipher;
    this.collections =
      this.vaultFilterComponent?.collections.fullList.filter((c) =>
        cipher.collectionIds.includes(c.id),
      ) ?? null;
    this.action = "view";
    await this.go().catch(() => {});
  }

  async openAttachmentsDialog() {
    if (!this.userHasPremiumAccess) {
      await this.premiumUpgradePromptService.promptForPremium();
      return;
    }
    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: this.cipherId as CipherId,
    });
    const result = await firstValueFrom(dialogRef.closed).catch(() => null);
    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      await this.vaultItemsComponent?.refresh().catch(() => {});
    }
  }

  viewCipherMenu(cipher: CipherView) {
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
      return;
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
              ).catch(() => null);
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
      .catch(() => null);
  }

  async editCipher(cipher: CipherView) {
    if (await this.shouldReprompt(cipher, "edit")) {
      return;
    }
    this.cipherId = cipher.id;
    this.cipher = cipher;
    await this.buildFormConfig("edit");
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

  async addCipher(type: CipherType) {
    this.addType = type || this.activeFilter.cipherType;
    this.cipherId = null;
    await this.buildFormConfig("add");
    this.action = "add";
    this.prefillCipherFromFilter();
    await this.go().catch(() => {});
  }

  addCipherOptions() {
    const menu: RendererMenuItem[] = [
      {
        label: this.i18nService.t("typeLogin"),
        click: () => this.addCipherWithChangeDetection(CipherType.Login),
      },
      {
        label: this.i18nService.t("typeCard"),
        click: () => this.addCipherWithChangeDetection(CipherType.Card),
      },
      {
        label: this.i18nService.t("typeIdentity"),
        click: () => this.addCipherWithChangeDetection(CipherType.Identity),
      },
      {
        label: this.i18nService.t("typeSecureNote"),
        click: () => this.addCipherWithChangeDetection(CipherType.SecureNote),
      },
    ];
    invokeMenu(menu);
  }

  async savedCipher(cipher: CipherView) {
    this.cipherId = null;
    this.action = "view";
    await this.vaultItemsComponent?.refresh().catch(() => {});
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
    if (this.modal != null) {
      this.modal.close();
    }
    if (this.folderAddEditModalRef == null) {
      return;
    }
    const [modal, childComponent] = await this.modalService
      .openViewRef(
        FolderAddEditComponent,
        this.folderAddEditModalRef,
        (comp) => (comp.folderId = folderId),
      )
      .catch(() => [null, null] as any);
    this.modal = modal;
    if (childComponent) {
      childComponent.onSavedFolder.subscribe(async (folder: FolderView) => {
        this.modal?.close();
        await this.vaultFilterComponent
          ?.reloadCollectionsAndFolders(this.activeFilter)
          .catch(() => {});
      });
      childComponent.onDeletedFolder.subscribe(async (folder: FolderView) => {
        this.modal?.close();
        await this.vaultFilterComponent
          ?.reloadCollectionsAndFolders(this.activeFilter)
          .catch(() => {});
      });
    }
    if (this.modal) {
      this.modal.onClosed.pipe(takeUntilDestroyed()).subscribe(() => {
        this.modal = null;
      });
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

  private addCipherWithChangeDetection(type: CipherType) {
    this.functionWithChangeDetection(() => this.addCipher(type).catch(() => {}));
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
        if (this.action === "view") {
          this.messagingService.send("minimizeOnCopy");
        }
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
      const collections = this.vaultFilterComponent.collections.fullList.filter(
        (c) => c.id === this.activeFilter.selectedCollectionId,
      );
      if (collections.length > 0) {
        this.addOrganizationId = collections[0].organizationId;
        this.addCollectionIds = [this.activeFilter.selectedCollectionId];
      }
    } else if (this.activeFilter.selectedOrganizationId) {
      this.addOrganizationId = this.activeFilter.selectedOrganizationId;
    }
    if (this.activeFilter.selectedFolderId && this.activeFilter.selectedFolder) {
      this.folderId = this.activeFilter.selectedFolderId;
    }
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
