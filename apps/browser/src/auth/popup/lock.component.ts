import { Component, NgZone, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LockComponent as BaseLockComponent } from "@bitwarden/angular/auth/components/lock.component";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService, BiometricsService, BiometricStateService } from "@bitwarden/key-management";

import { BiometricErrors, BiometricErrorTypes } from "../../models/biometricErrors";
import { BrowserRouterService } from "../../platform/popup/services/browser-router.service";
import { fido2PopoutSessionData$ } from "../../vault/popup/utils/fido2-popout-session-data";

@Component({
  selector: "app-lock",
  templateUrl: "lock.component.html",
})
export class LockComponent extends BaseLockComponent implements OnInit {
  private isInitialLockScreen: boolean;

  biometricError: string;
  pendingBiometric = false;
  fido2PopoutSessionData$ = fido2PopoutSessionData$();

  constructor(
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    keyService: KeyService,
    vaultTimeoutService: VaultTimeoutService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    environmentService: EnvironmentService,
    stateService: StateService,
    apiService: ApiService,
    logService: LogService,
    ngZone: NgZone,
    policyApiService: PolicyApiServiceAbstraction,
    policyService: InternalPolicyService,
    passwordStrengthService: PasswordStrengthServiceAbstraction,
    authService: AuthService,
    dialogService: DialogService,
    deviceTrustService: DeviceTrustServiceAbstraction,
    userVerificationService: UserVerificationService,
    pinService: PinServiceAbstraction,
    private routerService: BrowserRouterService,
    biometricStateService: BiometricStateService,
    biometricsService: BiometricsService,
    accountService: AccountService,
    kdfConfigService: KdfConfigService,
    syncService: SyncService,
    toastService: ToastService,
  ) {
    super(
      masterPasswordService,
      router,
      i18nService,
      platformUtilsService,
      messagingService,
      keyService,
      vaultTimeoutService,
      vaultTimeoutSettingsService,
      environmentService,
      stateService,
      apiService,
      logService,
      ngZone,
      policyApiService,
      policyService,
      passwordStrengthService,
      dialogService,
      deviceTrustService,
      userVerificationService,
      pinService,
      biometricStateService,
      biometricsService,
      accountService,
      authService,
      kdfConfigService,
      syncService,
      toastService,
    );
    this.successRoute = "/tabs/current";
    this.isInitialLockScreen = (window as any).previousPopupUrl == null;

    super.onSuccessfulSubmit = async () => {
      const previousUrl = this.routerService.getPreviousUrl();
      if (previousUrl) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigateByUrl(previousUrl);
      } else {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate([this.successRoute]);
      }
    };
  }

  async ngOnInit() {
    await super.ngOnInit();
    const autoBiometricsPrompt = await firstValueFrom(
      this.biometricStateService.promptAutomatically$,
    );

    window.setTimeout(async () => {
      document.getElementById(this.pinEnabled ? "pin" : "masterPassword")?.focus();
      if (
        this.biometricLock &&
        autoBiometricsPrompt &&
        this.isInitialLockScreen &&
        (await this.authService.getAuthStatus()) === AuthenticationStatus.Locked
      ) {
        await this.unlockBiometric(true);
      }
    }, 100);
  }

  override async unlockBiometric(automaticPrompt: boolean = false): Promise<boolean> {
    if (!this.biometricLock) {
      return;
    }

    this.biometricError = null;

    let success;
    try {
      const available = await super.isBiometricUnlockAvailable();
      if (!available) {
        if (!automaticPrompt) {
          await this.dialogService.openSimpleDialog({
            type: "warning",
            title: { key: "biometricsNotAvailableTitle" },
            content: { key: "biometricsNotAvailableDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
          });
        }
      } else {
        this.pendingBiometric = true;
        success = await super.unlockBiometric();
      }
    } catch (e) {
      const error = BiometricErrors[e?.message as BiometricErrorTypes];

      if (error == null) {
        this.logService.error("Unknown error: " + e);
        return false;
      }

      this.biometricError = this.i18nService.t(error.description);
    } finally {
      this.pendingBiometric = false;
    }

    return success;
  }
}
