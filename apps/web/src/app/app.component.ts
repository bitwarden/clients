// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, NgZone, OnDestroy, OnInit, effect } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Subject, firstValueFrom, map } from "rxjs";

import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { DialogService, RouterFocusManagerService, ToastService } from "@bitwarden/components";
import { LockService, LockSource } from "@bitwarden/unlock";

import { WebLogoutService } from "./auth/core/services/logout";

const BroadcasterSubscriptionId = "AppComponent";
const IdleTimeout = 60000 * 10; // 10 minutes

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  standalone: false,
})
export class AppComponent implements OnDestroy, OnInit {
  private lastActivity: Date = null;
  private idleTimer: number = null;
  private isIdle = false;
  private destroy$ = new Subject<void>();

  // Show the loading state during a logout, so that the login screen does not flash before
  // the page reloads.
  protected readonly loading = this.logoutService.loggingOut;

  constructor(
    private broadcasterService: BroadcasterService,
    private router: Router,
    private toastService: ToastService,
    private platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    private lockService: LockService,
    private serverNotificationsService: ServerNotificationsService,
    protected configService: ConfigService,
    private dialogService: DialogService,
    private organizationService: InternalOrganizationServiceAbstraction,
    private accountService: AccountService,
    private deviceTrustToastService: DeviceTrustToastService,
    private readonly destroy: DestroyRef,
    private readonly documentLangSetter: DocumentLangSetter,
    private readonly routerFocusManager: RouterFocusManagerService,
    private readonly logoutService: WebLogoutService,
  ) {
    this.deviceTrustToastService.setupListeners$.pipe(takeUntilDestroyed()).subscribe();

    const langSubscription = this.documentLangSetter.start();

    this.routerFocusManager.start$.pipe(takeUntilDestroyed()).subscribe();

    effect(() => {
      if (this.loading()) {
        document.body.classList.add("layout_frontend");
      }
    });

    this.destroy.onDestroy(() => {
      langSubscription.unsubscribe();
    });
  }

  ngOnInit() {
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
          case "authBlocked":
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/"]);
            break;
          case "logout": {
            const userId =
              message.userId ??
              (await firstValueFrom(getUserId(this.accountService.activeAccount$)));
            await this.logoutService.logout(userId, message.logoutReason);
            break;
          }
          case "lockVault": {
            const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
            await this.lockService.lock(userId, LockSource.Manual);
            break;
          }
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
          case "syncOrganizationStatusChanged": {
            const { organizationId, enabled } = message;
            const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
            const organizations = await firstValueFrom(
              this.organizationService.organizations$(userId),
            );
            const organization = organizations.find((org) => org.id === organizationId);

            if (organization) {
              const updatedOrganization = {
                ...organization,
                enabled: enabled,
              };
              await this.organizationService.upsert(updatedOrganization, userId);
            }
            break;
          }
          case "syncOrganizationCollectionSettingChanged": {
            const { organizationId, limitCollectionCreation, limitCollectionDeletion } = message;
            const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
            const organizations = await firstValueFrom(
              this.organizationService.organizations$(userId),
            );
            const organization = organizations.find((org) => org.id === organizationId);

            if (organization) {
              await this.organizationService.upsert(
                {
                  ...organization,
                  limitCollectionCreation: limitCollectionCreation,
                  limitCollectionDeletion: limitCollectionDeletion,
                },
                userId,
              );
            }
            break;
          }
          default:
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
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
      this.serverNotificationsService.disconnectFromInactivity();
    } else {
      this.serverNotificationsService.reconnectFromActivity();
    }
  }
}
