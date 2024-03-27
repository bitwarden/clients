import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  SecurityContext,
  Type,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { IndividualConfig, ToastrService } from "ngx-toastr";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { FingerprintDialogComponent } from "@bitwarden/auth/angular";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService } from "@bitwarden/components";

import { DeleteAccountComponent } from "../auth/delete-account.component";
import { LoginApprovalComponent } from "../auth/login/login-approval.component";
import { MenuAccount, MenuUpdateRequest } from "../main/menu/menu.updater";
import { PremiumComponent } from "../vault/app/accounts/premium.component";
import { FolderAddEditComponent } from "../vault/app/vault/folder-add-edit.component";

import { SettingsComponent } from "./accounts/settings.component";
import { ExportComponent } from "./tools/export/export.component";
import { GeneratorComponent } from "./tools/generator.component";
import { ImportDesktopComponent } from "./tools/import/import-desktop.component";
import { PasswordGeneratorHistoryComponent } from "./tools/password-generator-history.component";

const BroadcasterSubscriptionId = "AppComponent";
const IdleTimeout = 60000 * 10; // 10 minutes
const SyncInterval = 6 * 60 * 60 * 1000; // 6 hours

const systemTimeoutOptions = {
  onLock: -2,
  onSuspend: -3,
  onIdle: -4,
};

@Component({
  selector: "app-root",
  styles: [],
  template: `
    <ng-template #settings></ng-template>
    <ng-template #premium></ng-template>
    <ng-template #passwordHistory></ng-template>
    <ng-template #appFolderAddEdit></ng-template>
    <ng-template #exportVault></ng-template>
    <ng-template #appGenerator></ng-template>
    <ng-template #loginApproval></ng-template>
    <app-header></app-header>

    <div id="container">
      <div class="loading" *ngIf="loading">
        <i class="bwi bwi-spinner bwi-spin bwi-3x" aria-hidden="true"></i>
      </div>
      <router-outlet *ngIf="!loading"></router-outlet>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild("settings", { read: ViewContainerRef, static: true }) settingsRef: ViewContainerRef;
  @ViewChild("premium", { read: ViewContainerRef, static: true }) premiumRef: ViewContainerRef;
  @ViewChild("passwordHistory", { read: ViewContainerRef, static: true })
  passwordHistoryRef: ViewContainerRef;
  @ViewChild("exportVault", { read: ViewContainerRef, static: true })
  exportVaultModalRef: ViewContainerRef;
  @ViewChild("appFolderAddEdit", { read: ViewContainerRef, static: true })
  folderAddEditModalRef: ViewContainerRef;
  @ViewChild("appGenerator", { read: ViewContainerRef, static: true })
  generatorModalRef: ViewContainerRef;
  @ViewChild("loginApproval", { read: ViewContainerRef, static: true })
  loginApprovalModalRef: ViewContainerRef;

  loading = false;

  private lastActivity: number = null;
  private modal: ModalRef = null;
  private idleTimer: number = null;
  private isIdle = false;
  private activeUserId: string = null;

  private destroy$ = new Subject<void>();

  private accountCleanUpInProgress: { [userId: string]: boolean } = {};

  constructor(
    private broadcasterService: BroadcasterService,
    private folderService: InternalFolderService,
    private syncService: SyncService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private cipherService: CipherService,
    private authService: AuthService,
    private router: Router,
    private toastrService: ToastrService,
    private i18nService: I18nService,
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private cryptoService: CryptoService,
    private logService: LogService,
    private messagingService: MessagingService,
    private collectionService: CollectionService,
    private searchService: SearchService,
    private notificationsService: NotificationsService,
    private platformUtilsService: PlatformUtilsService,
    private systemService: SystemService,
    private stateService: StateService,
    private eventUploadService: EventUploadService,
    private policyService: InternalPolicyService,
    private modalService: ModalService,
    private keyConnectorService: KeyConnectorService,
    private userVerificationService: UserVerificationService,
    private configService: ConfigService,
    private dialogService: DialogService,
    private biometricStateService: BiometricStateService,
    private stateEventRunnerService: StateEventRunnerService,
    private providerService: ProviderService,
    private organizationService: InternalOrganizationServiceAbstraction,
  ) {}

  ngOnInit() {
    this.stateService.activeAccount$.pipe(takeUntil(this.destroy$)).subscribe((userId) => {
      this.activeUserId = userId;
    });

    this.ngZone.runOutsideAngular(() => {
      setTimeout(async () => {
        await this.updateAppMenu();
      }, 1000);

      window.ontouchstart = () => this.recordActivity();
      window.onmousedown = () => this.recordActivity();
      window.onscroll = () => this.recordActivity();
      window.onkeypress = () => this.recordActivity();
    });

    /// ############ DEPRECATED ############
    /// Please do not use the AppComponent to send events between services.
    ///
    /// Services that depends on other services, should do so through Dependency Injection
    /// and subscribe to events through that service observable.
    ///
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "loggedIn":
          case "unlocked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.recordActivity();
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection();
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.updateAppMenu();
            this.systemService.cancelProcessReload();
            break;
          case "loggedOut":
            this.modalService.closeAll();
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection();
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.updateAppMenu();
            await this.systemService.clearPendingClipboard();
            await this.systemService.startProcessReload(this.authService);
            break;
          case "authBlocked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["login"]);
            break;
          case "logout":
            this.loading = message.userId == null || message.userId === this.activeUserId;
            await this.logOut(!!message.expired, message.userId);
            this.loading = false;
            break;
          case "lockVault":
            await this.vaultTimeoutService.lock(message.userId);
            break;
          case "lockAllVaults": {
            const currentUser = await this.stateService.getUserId();
            const accounts = await firstValueFrom(this.stateService.accounts$);
            await this.vaultTimeoutService.lock(currentUser);
            for (const account of Object.keys(accounts)) {
              if (account === currentUser) {
                continue;
              }

              await this.vaultTimeoutService.lock(account);
            }
            break;
          }
          case "locked":
            this.modalService.closeAll();
            if (
              message.userId == null ||
              message.userId === (await this.stateService.getUserId())
            ) {
              await this.router.navigate(["lock"]);
            }
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection();
            await this.updateAppMenu();
            await this.systemService.clearPendingClipboard();
            await this.systemService.startProcessReload(this.authService);
            break;
          case "startProcessReload":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.systemService.startProcessReload(this.authService);
            break;
          case "cancelProcessReload":
            this.systemService.cancelProcessReload();
            break;
          case "reloadProcess":
            ipc.platform.reloadProcess();
            break;
          case "syncStarted":
            break;
          case "syncCompleted":
            if (message.successfully) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.updateAppMenu();
              await this.configService.ensureConfigFetched();
            }
            break;
          case "openSettings":
            await this.openModal<SettingsComponent>(SettingsComponent, this.settingsRef);
            break;
          case "openPremium":
            await this.openModal<PremiumComponent>(PremiumComponent, this.premiumRef);
            break;
          case "showFingerprintPhrase": {
            const fingerprint = await this.cryptoService.getFingerprint(
              await this.stateService.getUserId(),
            );
            const dialogRef = FingerprintDialogComponent.open(this.dialogService, { fingerprint });
            await firstValueFrom(dialogRef.closed);
            break;
          }
          case "deleteAccount":
            DeleteAccountComponent.open(this.dialogService);
            break;
          case "openPasswordHistory":
            await this.openModal<PasswordGeneratorHistoryComponent>(
              PasswordGeneratorHistoryComponent,
              this.passwordHistoryRef,
            );
            break;
          case "showToast":
            this.showToast(message);
            break;
          case "copiedToClipboard":
            if (!message.clearing) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.systemService.clearClipboard(message.clipboardValue, message.clearMs);
            }
            break;
          case "ssoCallback":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["sso"], {
              queryParams: { code: message.code, state: message.state },
            });
            break;
          case "premiumRequired": {
            const premiumConfirmed = await this.dialogService.openSimpleDialog({
              title: { key: "premiumRequired" },
              content: { key: "premiumRequiredDesc" },
              acceptButtonText: { key: "learnMore" },
              type: "success",
            });
            if (premiumConfirmed) {
              await this.openModal<PremiumComponent>(PremiumComponent, this.premiumRef);
            }
            break;
          }
          case "emailVerificationRequired": {
            const emailVerificationConfirmed = await this.dialogService.openSimpleDialog({
              title: { key: "emailVerificationRequired" },
              content: { key: "emailVerificationRequiredDesc" },
              acceptButtonText: { key: "learnMore" },
              type: "info",
            });
            if (emailVerificationConfirmed) {
              this.platformUtilsService.launchUri(
                "https://bitwarden.com/help/create-bitwarden-account/",
              );
            }
            break;
          }
          case "syncVault":
            try {
              await this.syncService.fullSync(true, true);
              this.platformUtilsService.showToast(
                "success",
                null,
                this.i18nService.t("syncingComplete"),
              );
            } catch {
              this.platformUtilsService.showToast(
                "error",
                null,
                this.i18nService.t("syncingFailed"),
              );
            }
            break;
          case "checkSyncVault":
            try {
              const lastSync = await this.syncService.getLastSync();
              let lastSyncAgo = SyncInterval + 1;
              if (lastSync != null) {
                lastSyncAgo = new Date().getTime() - lastSync.getTime();
              }

              if (lastSyncAgo >= SyncInterval) {
                await this.syncService.fullSync(false);
              }
            } catch (e) {
              this.logService.error(e);
            }
            this.messagingService.send("scheduleNextSync");
            break;
          case "importVault":
            await this.dialogService.open(ImportDesktopComponent);
            break;
          case "exportVault":
            await this.openExportVault();
            break;
          case "newLogin":
            this.routeToVault("add", CipherType.Login);
            break;
          case "newCard":
            this.routeToVault("add", CipherType.Card);
            break;
          case "newIdentity":
            this.routeToVault("add", CipherType.Identity);
            break;
          case "newSecureNote":
            this.routeToVault("add", CipherType.SecureNote);
            break;
          default:
            break;
          case "newFolder":
            await this.addFolder();
            break;
          case "openGenerator":
            // openGenerator has extended functionality if called in the vault
            if (!this.router.url.includes("vault")) {
              await this.openGenerator();
            }
            break;
          case "convertAccountToKeyConnector":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/remove-password"]);
            break;
          case "switchAccount": {
            if (message.userId != null) {
              await this.stateService.setActiveUser(message.userId);
            }
            const locked =
              (await this.authService.getAuthStatus(message.userId)) ===
              AuthenticationStatus.Locked;
            const forcedPasswordReset =
              (await this.stateService.getForceSetPasswordReason({ userId: message.userId })) !=
              ForceSetPasswordReason.None;
            if (locked) {
              this.messagingService.send("locked", { userId: message.userId });
            } else if (forcedPasswordReset) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.router.navigate(["update-temp-password"]);
            } else {
              this.messagingService.send("unlocked");
              this.loading = true;
              await this.syncService.fullSync(true);
              this.loading = false;
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.router.navigate(["vault"]);
            }
            break;
          }
          case "systemSuspended":
            await this.checkForSystemTimeout(systemTimeoutOptions.onSuspend);
            break;
          case "systemLocked":
            await this.checkForSystemTimeout(systemTimeoutOptions.onLock);
            break;
          case "systemIdle":
            await this.checkForSystemTimeout(systemTimeoutOptions.onIdle);
            break;
          case "openLoginApproval":
            if (message.notificationId != null) {
              this.dialogService.closeAll();
              const dialogRef = LoginApprovalComponent.open(this.dialogService, {
                notificationId: message.notificationId,
              });
              await firstValueFrom(dialogRef.closed);
            }
            break;
          case "redrawMenu":
            await this.updateAppMenu();
            break;
          case "deepLink":
            this.processDeepLink(message.urlString);
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async openExportVault() {
    this.modalService.closeAll();

    const [modal, childComponent] = await this.modalService.openViewRef(
      ExportComponent,
      this.exportVaultModalRef,
    );
    this.modal = modal;

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onSaved.subscribe(() => {
      this.modal.close();
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.modal.onClosed.subscribe(() => {
      this.modal = null;
    });
  }

  async addFolder() {
    this.modalService.closeAll();

    const [modal, childComponent] = await this.modalService.openViewRef(
      FolderAddEditComponent,
      this.folderAddEditModalRef,
      (comp) => (comp.folderId = null),
    );
    this.modal = modal;

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    childComponent.onSavedFolder.subscribe(async () => {
      this.modal.close();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.syncService.fullSync(false);
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.modal.onClosed.subscribe(() => {
      this.modal = null;
    });
  }

  async openGenerator() {
    this.modalService.closeAll();

    [this.modal] = await this.modalService.openViewRef(
      GeneratorComponent,
      this.generatorModalRef,
      (comp) => (comp.comingFromAddEdit = false),
    );

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.modal.onClosed.subscribe(() => {
      this.modal = null;
    });
  }

  private async updateAppMenu() {
    let updateRequest: MenuUpdateRequest;
    const stateAccounts = await firstValueFrom(this.stateService.accounts$);
    if (stateAccounts == null || Object.keys(stateAccounts).length < 1) {
      updateRequest = {
        accounts: null,
        activeUserId: null,
      };
    } else {
      const accounts: { [userId: string]: MenuAccount } = {};
      for (const i in stateAccounts) {
        if (
          i != null &&
          stateAccounts[i]?.profile?.userId != null &&
          !this.isAccountCleanUpInProgress(stateAccounts[i].profile.userId) // skip accounts that are being cleaned up
        ) {
          const userId = stateAccounts[i].profile.userId;
          const availableTimeoutActions = await firstValueFrom(
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(userId),
          );

          accounts[userId] = {
            isAuthenticated: await this.stateService.getIsAuthenticated({
              userId: userId,
            }),
            isLocked:
              (await this.authService.getAuthStatus(userId)) === AuthenticationStatus.Locked,
            isLockable: availableTimeoutActions.includes(VaultTimeoutAction.Lock),
            email: stateAccounts[i].profile.email,
            userId: stateAccounts[i].profile.userId,
            hasMasterPassword: await this.userVerificationService.hasMasterPassword(userId),
          };
        }
      }
      updateRequest = {
        accounts: accounts,
        activeUserId: await this.stateService.getUserId(),
      };
    }

    this.messagingService.send("updateAppMenu", { updateRequest: updateRequest });
  }

  private async logOut(expired: boolean, userId?: string) {
    const userBeingLoggedOut = await this.stateService.getUserId({ userId: userId });

    // Mark account as being cleaned up so that the updateAppMenu logic (executed on syncCompleted)
    // doesn't attempt to update a user that is being logged out as we will manually
    // call updateAppMenu when the logout is complete.
    this.startAccountCleanUp(userBeingLoggedOut);

    let preLogoutActiveUserId;
    try {
      // Provide the userId of the user to upload events for
      await this.eventUploadService.uploadEvents(userBeingLoggedOut as UserId);
      await this.syncService.setLastSync(new Date(0), userBeingLoggedOut);
      await this.cryptoService.clearKeys(userBeingLoggedOut);
      await this.cipherService.clear(userBeingLoggedOut);
      await this.folderService.clear(userBeingLoggedOut);
      await this.collectionService.clear(userBeingLoggedOut);
      await this.passwordGenerationService.clear(userBeingLoggedOut);
      await this.vaultTimeoutSettingsService.clear(userBeingLoggedOut);
      await this.policyService.clear(userBeingLoggedOut);
      await this.keyConnectorService.clear();
      await this.biometricStateService.logout(userBeingLoggedOut as UserId);
      await this.providerService.save(null, userBeingLoggedOut as UserId);

      await this.stateEventRunnerService.handleEvent("logout", userBeingLoggedOut as UserId);

      preLogoutActiveUserId = this.activeUserId;
      await this.stateService.clean({ userId: userBeingLoggedOut });
    } finally {
      this.finishAccountCleanUp(userBeingLoggedOut);
    }

    if (this.activeUserId == null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["login"]);
    } else if (preLogoutActiveUserId !== this.activeUserId) {
      this.messagingService.send("switchAccount");
    }

    await this.updateAppMenu();

    // This must come last otherwise the logout will prematurely trigger
    // a process reload before all the state service user data can be cleaned up
    if (userBeingLoggedOut === preLogoutActiveUserId) {
      this.searchService.clearIndex();
      this.authService.logOut(async () => {
        if (expired) {
          this.platformUtilsService.showToast(
            "warning",
            this.i18nService.t("loggedOut"),
            this.i18nService.t("loginExpired"),
          );
        }
      });
    }
  }

  private async recordActivity() {
    if (this.activeUserId == null) {
      return;
    }

    const now = new Date().getTime();
    if (this.lastActivity != null && now - this.lastActivity < 250) {
      return;
    }

    this.lastActivity = now;
    await this.stateService.setLastActive(now, { userId: this.activeUserId });

    // Idle states
    if (this.isIdle) {
      this.isIdle = false;
      this.idleStateChanged();
    }
    if (this.idleTimer != null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleTimer = window.setTimeout(() => {
      if (!this.isIdle) {
        this.isIdle = true;
        this.idleStateChanged();
      }
    }, IdleTimeout);
  }

  private idleStateChanged() {
    if (this.isIdle) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.notificationsService.disconnectFromInactivity();
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.notificationsService.reconnectFromActivity();
    }
  }

  private async openModal<T>(type: Type<T>, ref: ViewContainerRef) {
    this.modalService.closeAll();

    [this.modal] = await this.modalService.openViewRef(type, ref);

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.modal.onClosed.subscribe(() => {
      this.modal = null;
    });
  }

  private showToast(msg: any) {
    let message = "";

    const options: Partial<IndividualConfig> = {};

    if (typeof msg.text === "string") {
      message = msg.text;
    } else if (msg.text.length === 1) {
      message = msg.text[0];
    } else {
      msg.text.forEach(
        (t: string) =>
          (message += "<p>" + this.sanitizer.sanitize(SecurityContext.HTML, t) + "</p>"),
      );
      options.enableHtml = true;
    }
    if (msg.options != null) {
      if (msg.options.trustedHtml === true) {
        options.enableHtml = true;
      }
      if (msg.options.timeout != null && msg.options.timeout > 0) {
        options.timeOut = msg.options.timeout;
      }
    }

    this.toastrService.show(message, msg.title, options, "toast-" + msg.type);
  }

  private routeToVault(action: string, cipherType: CipherType) {
    if (!this.router.url.includes("vault")) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/vault"], {
        queryParams: {
          action: action,
          addType: cipherType,
        },
        replaceUrl: true,
      });
    }
  }

  private async checkForSystemTimeout(timeout: number): Promise<void> {
    const accounts = await firstValueFrom(this.stateService.accounts$);
    for (const userId in accounts) {
      if (userId == null) {
        continue;
      }
      const options = await this.getVaultTimeoutOptions(userId);
      if (options[0] === timeout) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        options[1] === "logOut"
          ? this.logOut(false, userId)
          : await this.vaultTimeoutService.lock(userId);
      }
    }
  }

  private async getVaultTimeoutOptions(userId: string): Promise<[number, string]> {
    const timeout = await this.stateService.getVaultTimeout({ userId: userId });
    const action = await this.stateService.getVaultTimeoutAction({ userId: userId });
    return [timeout, action];
  }

  // Mark an account's clean up as started
  private startAccountCleanUp(userId: string): void {
    this.accountCleanUpInProgress[userId] = true;
  }

  // Mark an account's clean up as finished
  private finishAccountCleanUp(userId: string): void {
    this.accountCleanUpInProgress[userId] = false;
  }

  // Check if an account's clean up is in progress
  private isAccountCleanUpInProgress(userId: string): boolean {
    return this.accountCleanUpInProgress[userId] === true;
  }

  // Process the sso callback links
  private processDeepLink(urlString: string) {
    const url = new URL(urlString);
    const code = url.searchParams.get("code");
    const receivedState = url.searchParams.get("state");
    let message = "";

    if (code === null) {
      return;
    }

    if (urlString.indexOf("bitwarden://duo-callback") === 0) {
      message = "duoCallback";
    } else if (receivedState === null) {
      return;
    }

    if (urlString.indexOf("bitwarden://import-callback-lp") === 0) {
      message = "importCallbackLastPass";
    } else if (urlString.indexOf("bitwarden://sso-callback") === 0) {
      message = "ssoCallback";
    }

    this.messagingService.send(message, { code: code, state: receivedState });
  }
}
