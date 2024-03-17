import { DOCUMENT } from "@angular/common";
import { Component, Inject, NgZone, OnDestroy, OnInit, SecurityContext } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { NavigationEnd, Router } from "@angular/router";
import * as jq from "jquery";
import { IndividualConfig, ToastrService } from "ngx-toastr";
import { Subject, switchMap, takeUntil, timer } from "rxjs";

import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { PaymentMethodWarningsServiceAbstraction as PaymentMethodWarningService } from "@bitwarden/common/billing/abstractions/payment-method-warnings-service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

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
import { RouterService } from "./core";

const BroadcasterSubscriptionId = "AppComponent";
const IdleTimeout = 60000 * 10; // 10 minutes
const PaymentMethodWarningsRefresh = 60000; // 1 Minute

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
})
export class AppComponent implements OnDestroy, OnInit {
  private lastActivity: number = null;
  private idleTimer: number = null;
  private isIdle = false;
  private destroy$ = new Subject<void>();
  private paymentMethodWarningsRefresh$ = timer(0, PaymentMethodWarningsRefresh);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private broadcasterService: BroadcasterService,
    private folderService: InternalFolderService,
    private settingsService: SettingsService,
    private syncService: SyncService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private cipherService: CipherService,
    private authService: AuthService,
    private router: Router,
    private toastrService: ToastrService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    private vaultTimeoutService: VaultTimeoutService,
    private cryptoService: CryptoService,
    private collectionService: CollectionService,
    private sanitizer: DomSanitizer,
    private searchService: SearchService,
    private notificationsService: NotificationsService,
    private routerService: RouterService,
    private stateService: StateService,
    private eventUploadService: EventUploadService,
    private policyService: InternalPolicyService,
    protected policyListService: PolicyListService,
    private keyConnectorService: KeyConnectorService,
    private configService: ConfigServiceAbstraction,
    private dialogService: DialogService,
    private biometricStateService: BiometricStateService,
    private stateEventRunnerService: StateEventRunnerService,
    private paymentMethodWarningService: PaymentMethodWarningService,
    private organizationService: OrganizationService,
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
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notificationsService.updateConnection(false);
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
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.logOut(!!message.expired, message.redirect);
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
              this.configService.triggerServerConfigFetch();
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
              this.router.navigate(["settings/subscription/premium"]);
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
            this.showToast(message);
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

    this.paymentMethodWarningsRefresh$
      .pipe(
        switchMap(() => this.organizationService.memberOrganizations$),
        switchMap(
          async (organizations) =>
            await Promise.all(
              organizations.map((organization) =>
                this.paymentMethodWarningService.update(organization.id),
              ),
            ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async logOut(expired: boolean, redirect = true) {
    await this.eventUploadService.uploadEvents();
    const userId = await this.stateService.getUserId();
    await Promise.all([
      this.syncService.setLastSync(new Date(0)),
      this.cryptoService.clearKeys(),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.collectionService.clear(userId),
      this.policyService.clear(userId),
      this.passwordGenerationService.clear(),
      this.keyConnectorService.clear(),
      this.biometricStateService.logout(userId as UserId),
      this.paymentMethodWarningService.clear(),
    ]);

    await this.stateEventRunnerService.handleEvent("logout", userId as UserId);

    this.searchService.clearIndex();
    this.authService.logOut(async () => {
      if (expired) {
        this.platformUtilsService.showToast(
          "warning",
          this.i18nService.t("loggedOut"),
          this.i18nService.t("loginExpired"),
        );
      }

      await this.stateService.clean({ userId: userId });
      if (redirect) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/"]);
      }
    });
  }

  private async recordActivity() {
    const now = new Date().getTime();
    if (this.lastActivity != null && now - this.lastActivity < 250) {
      return;
    }

    this.lastActivity = now;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.stateService.setLastActive(now);
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
