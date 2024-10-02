import { DOCUMENT } from "@angular/common";
import { Component, Inject, NgZone, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import * as jq from "jquery";
import { Subject, filter, firstValueFrom, map, takeUntil, timeout } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService, ToastOptions, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";

import { PolicyListService } from "./admin-console/core/policy-list.service";
import {
  DisableSendPolicy,
  MasterPasswordPolicy,
  PasswordGeneratorPolicy,
  PersonalOwnershipPolicy,
  RequireSsoPolicy,
  ResetPasswordPolicy,
  SendOptionsPolicy,
  SingleOrgPolicy,
  TwoFactorAuthenticationPolicy,
} from "./admin-console/organizations/policies";

const BroadcasterSubscriptionId = "AppComponent";
const IdleTimeout = 60000 * 10; // 10 minutes

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
})
export class AppComponent implements OnDestroy, OnInit {
  private lastActivity: Date = null;
  private idleTimer: number = null;
  private isIdle = false;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private broadcasterService: BroadcasterService,
    private folderService: InternalFolderService,
    private syncService: SyncService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private cipherService: CipherService,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    private vaultTimeoutService: VaultTimeoutService,
    private keyService: KeyService,
    private collectionService: CollectionService,
    private searchService: SearchService,
    private notificationsService: NotificationsService,
    private stateService: StateService,
    private eventUploadService: EventUploadService,
    private policyService: InternalPolicyService,
    protected policyListService: PolicyListService,
    private keyConnectorService: KeyConnectorService,
    protected configService: ConfigService,
    private dialogService: DialogService,
    private biometricStateService: BiometricStateService,
    private stateEventRunnerService: StateEventRunnerService,
    private organizationService: InternalOrganizationServiceAbstraction,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.i18nService.locale$.pipe(takeUntil(this.destroy$)).subscribe((locale) => {
      this.document.documentElement.lang = locale;
    });

    this.ngZone.runOutsideAngular(() => {
      window.onmousemove = () => this.recordActivity();
      window.onmousedown = () => this.recordActivity();
      window.ontouchstart = () => this.recordActivity();
      window.onclick = () => this.recordActivity();
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
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection(false);
            break;
          case "loggedOut":
            if (
              message.userId == null ||
              message.userId === (await firstValueFrom(this.accountService.activeAccount$))
            ) {
              await this.notificationsService.updateConnection(false);
            }
            break;
          case "unlocked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection(false);
            break;
          case "authBlocked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/"]);
            break;
          case "logout":
            await this.logOut(message.logoutReason, message.redirect);
            break;
          case "lockVault":
            await this.vaultTimeoutService.lock();
            break;
          case "locked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection(false);
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["lock"]);
            break;
          case "lockedUrl":
            break;
          case "syncStarted":
            break;
          case "syncCompleted":
            if (message.successfully) {
              await this.configService.ensureConfigFetched();
            }
            break;
          case "upgradeOrganization": {
            const upgradeConfirmed = await this.dialogService.openSimpleDialog({
              title: { key: "upgradeOrganization" },
              content: { key: "upgradeOrganizationDesc" },
              acceptButtonText: { key: "upgradeOrganization" },
              type: "info",
            });
            if (upgradeConfirmed) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.router.navigate([
                "organizations",
                message.organizationId,
                "billing",
                "subscription",
              ]);
            }
            break;
          }
          case "premiumRequired": {
            const premiumConfirmed = await this.dialogService.openSimpleDialog({
              title: { key: "premiumRequired" },
              content: { key: "premiumRequiredDesc" },
              acceptButtonText: { key: "upgrade" },
              type: "success",
            });
            if (premiumConfirmed) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              await this.router.navigate(["settings/subscription/premium"]);
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
          case "showToast":
            this.toastService._showToast(message);
            break;
          case "convertAccountToKeyConnector":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/remove-password"]);
            break;
          default:
            break;
        }
      });
    });

    this.router.events.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const modals = Array.from(document.querySelectorAll(".modal"));
        for (const modal of modals) {
          (jq(modal) as any).modal("hide");
        }
      }
    });

    this.policyListService.addPolicies([
      new TwoFactorAuthenticationPolicy(),
      new MasterPasswordPolicy(),
      new ResetPasswordPolicy(),
      new PasswordGeneratorPolicy(),
      new SingleOrgPolicy(),
      new RequireSsoPolicy(),
      new PersonalOwnershipPolicy(),
      new DisableSendPolicy(),
      new SendOptionsPolicy(),
    ]);
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
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
      default: {
        toastOptions = {
          variant: "info",
          title: this.i18nService.t("loggedOut"),
          message: this.i18nService.t("loggedOutDesc"),
        };
        break;
      }
    }

    this.toastService.showToast(toastOptions);
  }

  private async logOut(logoutReason: LogoutReason, redirect = true) {
    await this.displayLogoutReason(logoutReason);

    await this.eventUploadService.uploadEvents();
    const userId = (await this.stateService.getUserId()) as UserId;

    const logoutPromise = firstValueFrom(
      this.authService.authStatusFor$(userId).pipe(
        filter((authenticationStatus) => authenticationStatus === AuthenticationStatus.LoggedOut),
        timeout({
          first: 5_000,
          with: () => {
            throw new Error("The logout process did not complete in a reasonable amount of time.");
          },
        }),
      ),
    );

    await Promise.all([
      this.keyService.clearKeys(),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.collectionService.clear(userId),
      this.biometricStateService.logout(userId),
    ]);

    await this.stateEventRunnerService.handleEvent("logout", userId);

    await this.searchService.clearIndex();
    this.authService.logOut(async () => {
      await this.stateService.clean({ userId: userId });
      await this.accountService.clean(userId);
      await this.accountService.switchAccount(null);

      await logoutPromise;

      if (redirect) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/"]);
      }
    }, userId);
  }

  private async recordActivity() {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const now = new Date();
    if (this.lastActivity != null && now.getTime() - this.lastActivity.getTime() < 250) {
      return;
    }

    this.lastActivity = now;
    await this.accountService.setAccountActivity(activeUserId, now);
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
}
