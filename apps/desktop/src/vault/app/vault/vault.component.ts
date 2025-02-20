// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
import { firstValueFrom, Subject, takeUntil, switchMap } from "rxjs";
import { filter, first, map, take } from "rxjs/operators";

import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { DecryptionFailureDialogComponent, PasswordRepromptService } from "@bitwarden/vault";

import { SearchBarService } from "../../../app/layout/search/search-bar.service";
import { invokeMenu, RendererMenuItem } from "../../../utils";

import { AddEditComponent } from "./add-edit.component";
import { AttachmentsComponent } from "./attachments.component";
import { CollectionsComponent } from "./collections.component";
import { CredentialGeneratorDialogComponent } from "./credential-generator-dialog.component";
import { FolderAddEditComponent } from "./folder-add-edit.component";
import { PasswordHistoryComponent } from "./password-history.component";
import { ShareComponent } from "./share.component";
import { VaultFilterComponent } from "./vault-filter/vault-filter.component";
import { VaultItemsComponent } from "./vault-items.component";
import { ViewComponent } from "./view.component";

const BroadcasterSubscriptionId = "VaultComponent";

@Component({
  selector: "app-vault",
  templateUrl: "vault.component.html",
})
export class VaultComponent implements OnInit, OnDestroy {
  @ViewChild(ViewComponent) viewComponent: ViewComponent;
  @ViewChild(AddEditComponent) addEditComponent: AddEditComponent;
  @ViewChild(VaultItemsComponent, { static: true }) vaultItemsComponent: VaultItemsComponent;
  @ViewChild("generator", { read: ViewContainerRef, static: true })
  generatorModalRef: ViewContainerRef;
  @ViewChild(VaultFilterComponent, { static: true }) vaultFilterComponent: VaultFilterComponent;
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;
  @ViewChild("passwordHistory", { read: ViewContainerRef, static: true })
  passwordHistoryModalRef: ViewContainerRef;
  @ViewChild("share", { read: ViewContainerRef, static: true }) shareModalRef: ViewContainerRef;
  @ViewChild("collections", { read: ViewContainerRef, static: true })
  collectionsModalRef: ViewContainerRef;
  @ViewChild("folderAddEdit", { read: ViewContainerRef, static: true })
  folderAddEditModalRef: ViewContainerRef;

  action: string;
  cipherId: string = null;
  favorites = false;
  type: CipherType = null;
  folderId: string = null;
  collectionId: string = null;
  organizationId: string = null;
  myVaultOnly = false;
  addType: CipherType = null;
  addOrganizationId: string = null;
  addCollectionIds: string[] = null;
  showingModal = false;
  deleted = false;
  userHasPremiumAccess = false;
  activeFilter: VaultFilter = new VaultFilter();
  activeUserId: UserId;

  private modal: ModalRef = null;
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
    private configService: ConfigService,
    private accountService: AccountService,
    private cipherService: CipherService,
  ) {}

  async ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntil(this.componentIsDestroyed$),
      )
      .subscribe((canAccessPremium: boolean) => {
        this.userHasPremiumAccess = canAccessPremium;
      });

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        let detectChanges = true;

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
          case "focusSearch":
            (document.querySelector("#search") as HTMLInputElement).select();
            detectChanges = false;
            break;
          case "syncCompleted":
            await this.vaultItemsComponent.reload(this.activeFilter.buildFilter());
            await this.vaultFilterComponent.reloadCollectionsAndFolders(this.activeFilter);
            await this.vaultFilterComponent.reloadOrganizations();
            break;
          case "modalShown":
            this.showingModal = true;
            break;
          case "modalClosed":
            this.showingModal = false;
            break;
          case "copyUsername": {
            const uComponent =
              this.addEditComponent == null ? this.viewComponent : this.addEditComponent;
            const uCipher = uComponent != null ? uComponent.cipher : null;
            if (
              this.cipherId != null &&
              uCipher != null &&
              uCipher.id === this.cipherId &&
              uCipher.login != null &&
              uCipher.login.username != null
            ) {
              this.copyValue(uCipher, uCipher.login.username, "username", "Username");
            }
            break;
          }
          case "copyPassword": {
            const pComponent =
              this.addEditComponent == null ? this.viewComponent : this.addEditComponent;
            const pCipher = pComponent != null ? pComponent.cipher : null;
            if (
              this.cipherId != null &&
              pCipher != null &&
              pCipher.id === this.cipherId &&
              pCipher.login != null &&
              pCipher.login.password != null &&
              pCipher.viewPassword
            ) {
              this.copyValue(pCipher, pCipher.login.password, "password", "Password");
            }
            break;
          }
          case "copyTotp": {
            const tComponent =
              this.addEditComponent == null ? this.viewComponent : this.addEditComponent;
            const tCipher = tComponent != null ? tComponent.cipher : null;
            if (
              this.cipherId != null &&
              tCipher != null &&
              tCipher.id === this.cipherId &&
              tCipher.login != null &&
              tCipher.login.hasTotp &&
              this.userHasPremiumAccess
            ) {
              const value = await this.totpService.getCode(tCipher.login.totp);
              this.copyValue(tCipher, value, "verificationCodeTotp", "TOTP");
            }
            break;
          }
          default:
            detectChanges = false;
            break;
        }

        if (detectChanges) {
          this.changeDetectorRef.detectChanges();
        }
      });
    });

    if (!this.syncService.syncInProgress) {
      await this.load();
    }

    this.searchBarService.setEnabled(true);
    this.searchBarService.setPlaceholderText(this.i18nService.t("searchVault"));

    const authRequest = await this.apiService.getLastAuthRequest();
    if (authRequest != null) {
      this.messagingService.send("openLoginApproval", {
        notificationId: authRequest.id,
      });
    }

    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

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

  ngOnDestroy() {
    this.searchBarService.setEnabled(false);
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.componentIsDestroyed$.next(true);
    this.componentIsDestroyed$.complete();
  }

  async load() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (params.cipherId) {
        const cipherView = new CipherView();
        cipherView.id = params.cipherId;
        if (params.action === "clone") {
          await this.cloneCipher(cipherView);
        } else if (params.action === "edit") {
          await this.editCipher(cipherView);
        } else {
          await this.viewCipher(cipherView);
        }
      } else if (params.action === "add") {
        this.addType = Number(params.addType);
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.addCipher(this.addType);
      }

      this.activeFilter = new VaultFilter({
        status: params.deleted ? "trash" : params.favorites ? "favorites" : "all",
        cipherType:
          params.action === "add" || params.type == null ? null : parseInt(params.type, null),
        selectedFolderId: params.folderId,
        selectedCollectionId: params.selectedCollectionId,
        selectedOrganizationId: params.selectedOrganizationId,
        myVaultOnly: params.myVaultOnly ?? false,
      });
      await this.vaultItemsComponent.reload(this.activeFilter.buildFilter());
    });
  }

  async viewCipher(cipher: CipherView) {
    if (!(await this.canNavigateAway("view", cipher))) {
      return;
    }

    this.cipherId = cipher.id;
    this.action = "view";
    this.go();
  }

  viewCipherMenu(cipher: CipherView) {
    const menu: RendererMenuItem[] = [
      {
        label: this.i18nService.t("view"),
        click: () =>
          this.functionWithChangeDetection(() => {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.viewCipher(cipher);
          }),
      },
    ];

    if (cipher.decryptionFailure) {
      invokeMenu(menu);
      return;
    }

    if (!cipher.isDeleted) {
      menu.push({
        label: this.i18nService.t("edit"),
        click: () =>
          this.functionWithChangeDetection(() => {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.editCipher(cipher);
          }),
      });
      if (!cipher.organizationId) {
        menu.push({
          label: this.i18nService.t("clone"),
          click: () =>
            this.functionWithChangeDetection(() => {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.cloneCipher(cipher);
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
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
            },
          });
        }
        if (cipher.login.hasTotp && (cipher.organizationUseTotp || this.userHasPremiumAccess)) {
          menu.push({
            label: this.i18nService.t("copyVerificationCodeTotp"),
            click: async () => {
              const value = await this.totpService.getCode(cipher.login.totp);
              this.copyValue(cipher, value, "verificationCodeTotp", "TOTP");
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
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, cipher.id);
            },
          });
        }
        break;
      default:
        break;
    }

    invokeMenu(menu);
  }

  async editCipher(cipher: CipherView) {
    if (!(await this.canNavigateAway("edit", cipher))) {
      return;
    } else if (!(await this.passwordReprompt(cipher))) {
      return;
    }

    await this.editCipherWithoutPasswordPrompt(cipher);
  }

  async editCipherWithoutPasswordPrompt(cipher: CipherView) {
    if (!(await this.canNavigateAway("edit", cipher))) {
      return;
    }

    this.cipherId = cipher.id;
    this.action = "edit";
    this.go();
  }

  async cloneCipher(cipher: CipherView) {
    if (!(await this.canNavigateAway("clone", cipher))) {
      return;
    } else if (!(await this.passwordReprompt(cipher))) {
      return;
    }

    await this.cloneCipherWithoutPasswordPrompt(cipher);
  }

  async cloneCipherWithoutPasswordPrompt(cipher: CipherView) {
    if (!(await this.canNavigateAway("edit", cipher))) {
      return;
    }

    this.cipherId = cipher.id;
    this.action = "clone";
    this.go();
  }

  async addCipher(type: CipherType = null) {
    if (!(await this.canNavigateAway("add", null))) {
      return;
    }

    this.addType = type || this.activeFilter.cipherType;
    this.action = "add";
    this.cipherId = null;
    this.prefillNewCipherFromFilter();
    this.go();
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
    this.cipherId = cipher.id;
    this.action = "view";
    await this.vaultItemsComponent.refresh();
    await this.cipherService.clearCache(this.activeUserId);
    await this.viewComponent.load();
    this.go();
  }

  async deletedCipher(cipher: CipherView) {
    this.cipherId = null;
    this.action = null;
    this.go();
    await this.vaultItemsComponent.refresh();
  }

  async restoredCipher(cipher: CipherView) {
    this.cipherId = null;
    this.action = null;
    this.go();
    await this.vaultItemsComponent.refresh();
  }

  async editCipherAttachments(cipher: CipherView) {
    if (this.modal != null) {
      this.modal.close();
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      AttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => (comp.cipherId = cipher.id),
    );
    this.modal = modal;

    let madeAttachmentChanges = false;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onUploadedAttachment.subscribe((cipher) => {
      madeAttachmentChanges = true;
      // Update the edit component cipher with the updated cipher,
      // which is needed because the revision date is updated when an attachment is altered
      this.addEditComponent.patchCipherAttachments(cipher);
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onDeletedAttachment.subscribe((cipher) => {
      madeAttachmentChanges = true;
      // Update the edit component cipher with the updated cipher,
      // which is needed because the revision date is updated when an attachment is altered
      this.addEditComponent.patchCipherAttachments(cipher);
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.modal.onClosed.subscribe(async () => {
      this.modal = null;
      if (madeAttachmentChanges) {
        await this.vaultItemsComponent.refresh();
      }
      madeAttachmentChanges = false;
    });
  }

  async shareCipher(cipher: CipherView) {
    if (this.modal != null) {
      this.modal.close();
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      ShareComponent,
      this.shareModalRef,
      (comp) => (comp.cipherId = cipher.id),
    );
    this.modal = modal;

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    childComponent.onSharedCipher.subscribe(async () => {
      this.modal.close();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.viewCipher(cipher);
      await this.vaultItemsComponent.refresh();
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.modal.onClosed.subscribe(async () => {
      this.modal = null;
    });
  }

  async cipherCollections(cipher: CipherView) {
    if (this.modal != null) {
      this.modal.close();
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      CollectionsComponent,
      this.collectionsModalRef,
      (comp) => (comp.cipherId = cipher.id),
    );
    this.modal = modal;

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onSavedCollections.subscribe(() => {
      this.modal.close();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.viewCipher(cipher);
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.modal.onClosed.subscribe(async () => {
      this.modal = null;
    });
  }

  async viewCipherPasswordHistory(cipher: CipherView) {
    if (this.modal != null) {
      this.modal.close();
    }

    [this.modal] = await this.modalService.openViewRef(
      PasswordHistoryComponent,
      this.passwordHistoryModalRef,
      (comp) => (comp.cipherId = cipher.id),
    );

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.modal.onClosed.subscribe(async () => {
      this.modal = null;
    });
  }

  cancelledAddEdit(cipher: CipherView) {
    this.cipherId = cipher.id;
    this.action = this.cipherId != null ? "view" : null;
    this.go();
  }

  async applyVaultFilter(vaultFilter: VaultFilter) {
    this.searchBarService.setPlaceholderText(
      this.i18nService.t(this.calculateSearchBarLocalizationString(vaultFilter)),
    );
    this.activeFilter = vaultFilter;
    await this.vaultItemsComponent.reload(
      this.activeFilter.buildFilter(),
      vaultFilter.status === "trash",
    );
    this.go();
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
    if (vaultFilter.selectedFolderId != null && vaultFilter.selectedFolderId != "none") {
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

  async openGenerator(passwordType = true) {
    CredentialGeneratorDialogComponent.open(this.dialogService, {
      onCredentialGenerated: (value?: string) => {
        if (this.addEditComponent != null) {
          this.addEditComponent.markPasswordAsDirty();
          if (passwordType) {
            this.addEditComponent.cipher.login.password = value ?? "";
          } else {
            this.addEditComponent.cipher.login.username = value ?? "";
          }
        }
      },
      type: passwordType ? "password" : "username",
    });
    return;
  }

  async addFolder() {
    this.messagingService.send("newFolder");
  }

  async editFolder(folderId: string) {
    if (this.modal != null) {
      this.modal.close();
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      FolderAddEditComponent,
      this.folderAddEditModalRef,
      (comp) => (comp.folderId = folderId),
    );
    this.modal = modal;

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    childComponent.onSavedFolder.subscribe(async (folder: FolderView) => {
      this.modal.close();
      await this.vaultFilterComponent.reloadCollectionsAndFolders(this.activeFilter);
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    childComponent.onDeletedFolder.subscribe(async (folder: FolderView) => {
      this.modal.close();
      await this.vaultFilterComponent.reloadCollectionsAndFolders(this.activeFilter);
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.modal.onClosed.subscribe(() => {
      this.modal = null;
    });
  }

  private dirtyInput(): boolean {
    return (
      (this.action === "add" || this.action === "edit" || this.action === "clone") &&
      document.querySelectorAll("app-vault-add-edit .ng-dirty").length > 0
    );
  }

  private async wantsToSaveChanges(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "unsavedChangesTitle" },
      content: { key: "unsavedChangesConfirmation" },
      type: "warning",
    });
    return !confirmed;
  }

  private go(queryParams: any = null) {
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

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      replaceUrl: true,
    });
  }

  private addCipherWithChangeDetection(type: CipherType = null) {
    this.functionWithChangeDetection(() => this.addCipher(type));
  }

  private copyValue(cipher: CipherView, value: string, labelI18nKey: string, aType: string) {
    this.functionWithChangeDetection(async () => {
      if (
        cipher.reprompt !== CipherRepromptType.None &&
        this.passwordRepromptService.protectedFields().includes(aType) &&
        !(await this.passwordRepromptService.showPasswordPrompt())
      ) {
        return;
      }

      this.platformUtilsService.copyToClipboard(value);
      this.toastService.showToast({
        variant: "info",
        title: null,
        message: this.i18nService.t("valueCopied", this.i18nService.t(labelI18nKey)),
      });
      if (this.action === "view") {
        this.messagingService.send("minimizeOnCopy");
      }
    });
  }

  private functionWithChangeDetection(func: () => void) {
    this.ngZone.run(() => {
      func();
      this.changeDetectorRef.detectChanges();
    });
  }

  private prefillNewCipherFromFilter() {
    if (this.activeFilter.selectedCollectionId != null) {
      const collection = this.vaultFilterComponent.collections.fullList.filter(
        (c) => c.id === this.activeFilter.selectedCollectionId,
      );
      if (collection.length > 0) {
        this.addOrganizationId = collection[0].organizationId;
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
    // Don't navigate to same route
    if (this.action === action && (cipher == null || this.cipherId === cipher.id)) {
      return false;
    } else if (this.dirtyInput() && (await this.wantsToSaveChanges())) {
      return false;
    }

    return true;
  }

  private async passwordReprompt(cipher: CipherView) {
    return (
      cipher.reprompt === CipherRepromptType.None ||
      (await this.passwordRepromptService.showPasswordPrompt())
    );
  }
}
