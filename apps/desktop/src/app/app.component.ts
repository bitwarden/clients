// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  DestroyRef,
  NgZone,
  OnDestroy,
  OnInit,
  Type,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import {
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  Subject,
  switchMap,
  takeUntil,
  timeout,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { LoginApprovalDialogComponent } from "@bitwarden/angular/auth/login-approval";
import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { FingerprintDialogComponent } from "@bitwarden/auth/angular";
import {
  AuthRequestServiceAbstraction,
  DESKTOP_SSO_CALLBACK,
  LogoutReason,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogRef, DialogService, ToastOptions, ToastService } from "@bitwarden/components";
import { CredentialGeneratorHistoryDialogComponent } from "@bitwarden/generator-components";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";
import { AddEditFolderDialogComponent, AddEditFolderDialogResult } from "@bitwarden/vault";

import { DeleteAccountComponent } from "../auth/delete-account.component";
import { DesktopAutotypeDefaultSettingPolicy } from "../autofill/services/desktop-autotype-policy.service";
import { PremiumComponent } from "../billing/app/accounts/premium.component";
import { MenuAccount, MenuUpdateRequest } from "../main/menu/menu.updater";

import { SettingsComponent } from "./accounts/settings.component";
import { ExportDesktopComponent } from "./tools/export/export-desktop.component";
import { CredentialGeneratorComponent } from "./tools/generator/credential-generator.component";
import { ImportDesktopComponent } from "./tools/import/import-desktop.component";

const BroadcasterSubscriptionId = "AppComponent";
const IdleTimeout = 60000 * 10; // 10 minutes
const SyncInterval = 6 * 60 * 60 * 1000; // 6 hours

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-root",
  styles: [],
  template: `
    <ng-template #settings></ng-template>
    <ng-template #premium></ng-template>
    <ng-template #passwordHistory></ng-template>
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

    <bit-toast-container></bit-toast-container>
  `,
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("settings", { read: ViewContainerRef, static: true }) settingsRef: ViewContainerRef;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("premium", { read: ViewContainerRef, static: true }) premiumRef: ViewContainerRef;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("passwordHistory", { read: ViewContainerRef, static: true })
  passwordHistoryRef: ViewContainerRef;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("exportVault", { read: ViewContainerRef, static: true })
  exportVaultModalRef: ViewContainerRef;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("appGenerator", { read: ViewContainerRef, static: true })
  generatorModalRef: ViewContainerRef;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("loginApproval", { read: ViewContainerRef, static: true })
  loginApprovalModalRef: ViewContainerRef;

  loading = false;

  private lastActivity: Date = null;
  private modal: ModalRef = null;
  private idleTimer: number = null;
  private isIdle = false;
  private activeUserId: UserId = null;
  private activeSimpleDialog: DialogRef<boolean> = null;
  private processingPendingAuth = false;

  private destroy$ = new Subject<void>();

  private accountCleanUpInProgress: { [userId: string]: boolean } = {};

  constructor(
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private broadcasterService: BroadcasterService,
    private folderService: InternalFolderService,
    private syncService: SyncService,
    private cipherService: CipherService,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private i18nService: I18nService,
    private ngZone: NgZone,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private keyService: KeyService,
    private logService: LogService,
    private messagingService: MessagingService,
    private collectionService: CollectionService,
    private searchService: SearchService,
    private notificationsService: ServerNotificationsService,
    private platformUtilsService: PlatformUtilsService,
    private systemService: SystemService,
    private processReloadService: ProcessReloadServiceAbstraction,
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
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private deviceTrustToastService: DeviceTrustToastService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private readonly destroyRef: DestroyRef,
    private readonly documentLangSetter: DocumentLangSetter,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private pinService: PinServiceAbstraction,
    private readonly tokenService: TokenService,
    private desktopAutotypeDefaultSettingPolicy: DesktopAutotypeDefaultSettingPolicy,
    private pendingAuthRequestsState: PendingAuthRequestsStateService,
    private authRequestService: AuthRequestServiceAbstraction,
    private authRequestAnsweringService: AuthRequestAnsweringService,
  ) {
    this.deviceTrustToastService.setupListeners$.pipe(takeUntilDestroyed()).subscribe();

    const langSubscription = this.documentLangSetter.start();
    this.destroyRef.onDestroy(() => langSubscription.unsubscribe());
  }

  ngOnInit() {
    this.accountService.activeAccount$.pipe(takeUntil(this.destroy$)).subscribe((account) => {
      this.activeUserId = account?.id;
    });

    this.authRequestAnsweringService.setupUnlockListenersForProcessingAuthRequests(this.destroy$);

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
            this.updateAppMenu();
            this.processReloadService.cancelProcessReload();
            break;
          case "loggedOut":
            this.modalService.closeAll();
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.updateAppMenu();
            await this.systemService.clearPendingClipboard();
            await this.processReloadService.startProcessReload(this.authService);
            break;
          case "authBlocked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["login"]);
            break;
          case "logout":
            this.loading = message.userId == null || message.userId === this.activeUserId;
            await this.logOut(message.logoutReason, message.userId);
            this.loading = false;
            break;
          case "lockVault":
            await this.vaultTimeoutService.lock(message.userId);
            break;
          case "lockAllVaults": {
            const currentUser = await firstValueFrom(
              this.accountService.activeAccount$.pipe(map((a) => a.id)),
            );
            const accounts = await firstValueFrom(this.accountService.accounts$);
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
              message.userId ===
                (await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id))))
            ) {
              await this.router.navigate(["lock"]);
            }
            await this.updateAppMenu();
            await this.systemService.clearPendingClipboard();
            await this.processReloadService.startProcessReload(this.authService);
            break;
          case "startProcessReload":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.processReloadService.startProcessReload(this.authService);
            break;
          case "cancelProcessReload":
            this.processReloadService.cancelProcessReload();
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
            this.dialogService.open(PremiumComponent);
            break;
          case "showFingerprintPhrase": {
            const activeUserId = await firstValueFrom(
              getUserId(this.accountService.activeAccount$),
            );
            const publicKey = await firstValueFrom(this.keyService.userPublicKey$(activeUserId));
            if (publicKey == null) {
              this.logService.error(
                "[AppComponent] No public key available for the user: " +
                  activeUserId +
                  " fingerprint can't be displayed.",
              );
            } else {
              const fingerprint = await this.keyService.getFingerprint(activeUserId, publicKey);
              const dialogRef = FingerprintDialogComponent.open(this.dialogService, {
                fingerprint,
              });
              await firstValueFrom(dialogRef.closed);
            }
            break;
          }
          case "deleteAccount":
            await this.deleteAccount();
            break;
          case "openPasswordHistory":
            await this.openGeneratorHistory();
            break;
          case "showToast":
            this.toastService._showToast(message);
            break;
          case "copiedToClipboard":
            if (!message.clearing) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.systemService.clearClipboard(message.clipboardValue, message.clearMs);
            }
            break;
          case "ssoCallback": {
            const queryParams = {
              code: message.code,
              state: message.state,
              redirectUri: message.redirectUri ?? DESKTOP_SSO_CALLBACK,
            };
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["sso"], {
              queryParams: queryParams,
            });
            break;
          }
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
            await this.dialogService.open(ExportDesktopComponent);
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
            await this.openGenerator();
            break;
          case "convertAccountToKeyConnector":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/remove-password"]);
            break;
          case "switchAccount": {
            if (message.userId == null) {
              this.logService.error("'switchAccount' message received without userId.");
              return;
            }

            await this.accountService.switchAccount(message.userId);

            const locked =
              (await this.authService.getAuthStatus(message.userId)) ===
              AuthenticationStatus.Locked;
            if (locked) {
              this.modalService.closeAll();

              // We only have to handle TDE lock on "switchAccount" message scenarios but not normal
              // lock scenarios since the user will have always decrypted the vault at least once in those cases.
              const tdeEnabled = await firstValueFrom(
                this.userDecryptionOptionsService
                  .userDecryptionOptionsById$(message.userId)
                  .pipe(map((decryptionOptions) => decryptionOptions?.trustedDeviceOption != null)),
              );

              const everHadUserKey = await firstValueFrom(
                this.keyService.everHadUserKey$(message.userId),
              );
              if (tdeEnabled && !everHadUserKey) {
                await this.router.navigate(["login-initiated"]);
              } else {
                await this.router.navigate(["lock"]);
              }
            } else {
              this.messagingService.send("unlocked");
              this.loading = true;
              await this.syncService.fullSync(false);
              this.loading = false;
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.router.navigate(["vault"]);
            }
            this.messagingService.send("finishSwitchAccount");
            break;
          }
          case "systemSuspended":
            await this.checkForSystemTimeout(VaultTimeoutStringType.OnSleep);
            break;
          case "systemLocked":
            await this.checkForSystemTimeout(VaultTimeoutStringType.OnLocked);
            break;
          case "systemIdle":
            await this.checkForSystemTimeout(VaultTimeoutStringType.OnIdle);
            break;
          case "openLoginApproval":
            if (this.processingPendingAuth) {
              return;
            }

            this.processingPendingAuth = true;

            try {
              // Always query server for all pending requests and open a dialog for each
              const pendingList = await firstValueFrom(
                this.authRequestService.getPendingAuthRequests$(),
              );
              if (Array.isArray(pendingList) && pendingList.length > 0) {
                const respondedIds = new Set<string>();
                for (const req of pendingList) {
                  if (req?.id == null) {
                    continue;
                  }
                  const dialogRef = LoginApprovalDialogComponent.open(this.dialogService, {
                    notificationId: req.id,
                  });

                  const result = await firstValueFrom(dialogRef.closed);

                  if (result !== undefined && typeof result === "boolean") {
                    respondedIds.add(req.id);
                    if (respondedIds.size === pendingList.length && this.activeUserId != null) {
                      await this.pendingAuthRequestsState.clear(this.activeUserId);
                    }
                  }
                }
              }
            } finally {
              this.processingPendingAuth = false;
            }
            break;
          case "redrawMenu":
            await this.updateAppMenu();
            break;
          case "deepLink":
            this.processDeepLink(message.urlString);
            break;
          case "launchUri":
            this.platformUtilsService.launchUri(message.url);
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

  async addFolder() {
    this.modalService.closeAll();

    const dialogRef = AddEditFolderDialogComponent.open(this.dialogService);
    const result = await lastValueFrom(dialogRef.closed);
    if (result === AddEditFolderDialogResult.Created) {
      await this.syncService.fullSync(false);
    }
  }

  async openGenerator() {
    await this.dialogService.open(CredentialGeneratorComponent);
    return;
  }

  async openGeneratorHistory() {
    await this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
    return;
  }

  private async updateAppMenu() {
    let updateRequest: MenuUpdateRequest;
    const stateAccounts = await firstValueFrom(this.accountService.accounts$);

    if (stateAccounts == null || Object.keys(stateAccounts).length < 1) {
      updateRequest = {
        accounts: null,
        activeUserId: null,
        restrictedCipherTypes: null,
      };
    } else {
      const accounts: { [userId: string]: MenuAccount } = {};
      for (const i in stateAccounts) {
        const userId = i as UserId;
        if (
          i != null &&
          userId != null &&
          !this.isAccountCleanUpInProgress(userId) // skip accounts that are being cleaned up
        ) {
          const availableTimeoutActions = await firstValueFrom(
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(userId),
          );

          const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));
          accounts[userId] = {
            isAuthenticated: authStatus >= AuthenticationStatus.Locked,
            isLocked: authStatus === AuthenticationStatus.Locked,
            isLockable: availableTimeoutActions.includes(VaultTimeoutAction.Lock),
            email: stateAccounts[userId].email,
            userId: userId,
            hasMasterPassword: await this.userVerificationService.hasMasterPassword(userId),
          };
        }
      }
      updateRequest = {
        accounts: accounts,
        activeUserId: await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a?.id)),
        ),
        restrictedCipherTypes: (
          await firstValueFrom(this.restrictedItemTypesService.restricted$)
        ).map((restrictedItems) => restrictedItems.cipherType),
      };
    }

    this.messagingService.send("updateAppMenu", { updateRequest: updateRequest });
  }

  private async displayLogoutReason(logoutReason: LogoutReason) {
    let toastOptions: ToastOptions;

    switch (logoutReason) {
      case "invalidSecurityStamp":
      case "sessionExpired": {
        toastOptions = {
          variant: "warning",
          title: this.i18nService.t("loggedOut"),
          message: this.i18nService.t("loginExpired"),
        };
        break;
      }
      // We don't expect these scenarios to be common, but we want the user to
      // understand why they are being logged out before a process reload.
      case "accessTokenUnableToBeDecrypted": {
        // Don't create multiple dialogs if this fires multiple times
        if (this.activeSimpleDialog) {
          // Let the caller of this function listen for the dialog to close
          return firstValueFrom(this.activeSimpleDialog.closed);
        }

        this.activeSimpleDialog = this.dialogService.openSimpleDialogRef({
          title: { key: "loggedOut" },
          content: { key: "accessTokenUnableToBeDecrypted" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });

        await firstValueFrom(this.activeSimpleDialog.closed);
        this.activeSimpleDialog = null;

        break;
      }
      case "refreshTokenSecureStorageRetrievalFailure": {
        // Don't create multiple dialogs if this fires multiple times
        if (this.activeSimpleDialog) {
          // Let the caller of this function listen for the dialog to close
          return firstValueFrom(this.activeSimpleDialog.closed);
        }

        this.activeSimpleDialog = this.dialogService.openSimpleDialogRef({
          title: { key: "loggedOut" },
          content: { key: "refreshTokenSecureStorageRetrievalFailure" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });

        await firstValueFrom(this.activeSimpleDialog.closed);
        this.activeSimpleDialog = null;

        break;
      }
    }

    if (toastOptions) {
      this.toastService.showToast(toastOptions);
    }
  }

  // TODO: PM-21212 - consolidate the logic of this method into the new LogoutService
  // (requires creating a desktop specific implementation of the LogoutService)
  // Even though the userId parameter is no longer optional doesn't mean a message couldn't be
  // passing null-ish values to us.
  private async logOut(logoutReason: LogoutReason, userId: UserId) {
    await this.displayLogoutReason(logoutReason);

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    const userBeingLoggedOut = userId ?? activeUserId;

    // Mark account as being cleaned up so that the updateAppMenu logic (executed on syncCompleted)
    // doesn't attempt to update a user that is being logged out as we will manually
    // call updateAppMenu when the logout is complete.
    this.startAccountCleanUp(userBeingLoggedOut);

    const nextUpAccount =
      activeUserId === userBeingLoggedOut
        ? await firstValueFrom(this.accountService.nextUpAccount$) // We'll need to switch accounts
        : null;

    try {
      // HACK: We shouldn't wait for authentication status to change here but instead subscribe to the
      // authentication status to do various actions.
      const logoutPromise = firstValueFrom(
        this.authService.authStatusFor$(userBeingLoggedOut).pipe(
          filter((authenticationStatus) => authenticationStatus === AuthenticationStatus.LoggedOut),
          timeout({
            first: 5_000,
            with: () => {
              throw new Error(
                "The logout process did not complete in a reasonable amount of time.",
              );
            },
          }),
        ),
      );

      // Provide the userId of the user to upload events for
      await this.eventUploadService.uploadEvents(userBeingLoggedOut);
      await this.keyService.clearKeys(userBeingLoggedOut);
      await this.cipherService.clear(userBeingLoggedOut);
      await this.folderService.clear(userBeingLoggedOut);
      await this.biometricStateService.logout(userBeingLoggedOut);
      await this.pinService.logout(userBeingLoggedOut);

      await this.stateEventRunnerService.handleEvent("logout", userBeingLoggedOut);

      await this.stateService.clean({ userId: userBeingLoggedOut });
      await this.tokenService.clearAccessToken(userBeingLoggedOut);
      await this.accountService.clean(userBeingLoggedOut);

      // HACK: Wait for the user logging outs authentication status to transition to LoggedOut
      await logoutPromise;
    } finally {
      this.finishAccountCleanUp(userBeingLoggedOut);
    }

    // We only need to change the display at all if the account being looked at is the one
    // being logged out. If it was a background account, no need to do anything.
    if (userBeingLoggedOut === activeUserId) {
      if (nextUpAccount != null) {
        this.messagingService.send("switchAccount", { userId: nextUpAccount.id });
      } else {
        // We don't have another user to switch to, bring them to the login page so they
        // can sign into a user.
        await this.accountService.switchAccount(null);
        void this.router.navigate(["login"]);
      }
    }

    await this.updateAppMenu();

    // This must come last otherwise the logout will prematurely trigger
    // a process reload before all the state service user data can be cleaned up
    this.authService.logOut(async () => {}, userBeingLoggedOut);
  }

  private async recordActivity() {
    if (this.activeUserId == null) {
      return;
    }

    const now = new Date();
    if (this.lastActivity != null && now.getTime() - this.lastActivity.getTime() < 250) {
      return;
    }

    this.lastActivity = now;
    await this.accountService.setAccountActivity(this.activeUserId, now);

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
      this.notificationsService.disconnectFromInactivity();
    } else {
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

  private async checkForSystemTimeout(timeout: VaultTimeout): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    for (const userId in accounts) {
      if (userId == null) {
        continue;
      }
      const options = await this.getVaultTimeoutOptions(userId);
      if (options[0] === timeout) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        options[1] === "logOut"
          ? this.logOut("vaultTimeout", userId as UserId)
          : await this.vaultTimeoutService.lock(userId);
      }
    }
  }

  private async getVaultTimeoutOptions(userId: string): Promise<[VaultTimeout, string]> {
    const timeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    );
    const action = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
    );
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
    } else if (urlString.indexOf(DESKTOP_SSO_CALLBACK) === 0) {
      message = "ssoCallback";
    }

    this.messagingService.send(message, { code: code, state: receivedState });
  }

  private async deleteAccount() {
    const userIsManaged = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.organizationService.organizations$(userId)),
        map((orgs) => orgs.some((o) => o.userIsManagedByOrganization === true)),
      ),
    );

    if (userIsManaged) {
      await this.dialogService.openSimpleDialog({
        title: { key: "cannotDeleteAccount" },
        content: { key: "cannotDeleteAccountDesc" },
        cancelButtonText: null,
        acceptButtonText: { key: "close" },
        type: "danger",
      });

      return;
    }

    DeleteAccountComponent.open(this.dialogService);
  }
}
