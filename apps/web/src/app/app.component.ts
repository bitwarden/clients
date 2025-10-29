// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, NgZone, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Subject, filter, firstValueFrom, map, timeout } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";

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

  loading = false;

  constructor(
    private broadcasterService: BroadcasterService,
    private folderService: InternalFolderService,
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
    private serverNotificationsService: ServerNotificationsService,
    private stateService: StateService,
    private eventUploadService: EventUploadService,
    protected configService: ConfigService,
    private dialogService: DialogService,
    private biometricStateService: BiometricStateService,
    private stateEventRunnerService: StateEventRunnerService,
    private organizationService: InternalOrganizationServiceAbstraction,
    private accountService: AccountService,
    private processReloadService: ProcessReloadServiceAbstraction,
    private deviceTrustToastService: DeviceTrustToastService,
    private readonly destroy: DestroyRef,
    private readonly documentLangSetter: DocumentLangSetter,
    private readonly tokenService: TokenService,
  ) {
    this.deviceTrustToastService.setupListeners$.pipe(takeUntilDestroyed()).subscribe();

    const langSubscription = this.documentLangSetter.start();
    this.destroy.onDestroy(() => langSubscription.unsubscribe());
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
          case "logout":
            // note: the message.logoutReason isn't consumed anymore because of the process reload clearing any toasts.
            await this.logOut(message.redirect);
            break;
          case "lockVault":
            await this.vaultTimeoutService.lock();
            break;
          case "locked":
            await this.processReloadService.startProcessReload(this.authService);
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

  private async logOut(redirect = true) {
    // Ensure the loading state is applied before proceeding to avoid a flash
    // of the login screen before the process reload fires.
    this.ngZone.run(() => {
      this.loading = true;
      document.body.classList.add("layout_frontend");
    });

    // Note: we don't display a toast logout reason anymore as the process reload
    // will prevent any toasts from being displayed long enough to be read

    await this.eventUploadService.uploadEvents();
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

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
      this.keyService.clearKeys(userId),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.biometricStateService.logout(userId),
    ]);

    await this.stateEventRunnerService.handleEvent("logout", userId);

    await this.searchService.clearIndex(userId);
    this.authService.logOut(async () => {
      await this.stateService.clean({ userId: userId });
      await this.tokenService.clearAccessToken(userId);
      await this.accountService.clean(userId);
      await this.accountService.switchAccount(null);

      await logoutPromise;

      if (redirect) {
        await this.router.navigate(["/"]);
      }

      await this.processReloadService.startProcessReload(this.authService);

      // Normally we would need to reset the loading state to false or remove the layout_frontend
      // class from the body here, but the process reload completely reloads the app so
      // it handles it.
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
      this.serverNotificationsService.disconnectFromInactivity();
    } else {
      this.serverNotificationsService.reconnectFromActivity();
    }
  }
}
