import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { concatMap, delay, filter, firstValueFrom, takeUntil, throttleTime, timer } from "rxjs";

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
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { DeviceType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  KeyService,
  BiometricsService,
  BiometricStateService,
  BiometricsStatus,
  KdfConfigService,
} from "@bitwarden/key-management";

const BroadcasterSubscriptionId = "LockComponent";

@Component({
  selector: "app-lock",
  templateUrl: "lock.component.html",
})
export class LockComponent extends BaseLockComponent implements OnInit, OnDestroy {
  private deferFocus: boolean = null;
  private biometricAsked = false;
  private autoPromptBiometric = false;

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
    protected override stateService: StateService,
    apiService: ApiService,
    private route: ActivatedRoute,
    private broadcasterService: BroadcasterService,
    ngZone: NgZone,
    policyApiService: PolicyApiServiceAbstraction,
    policyService: InternalPolicyService,
    passwordStrengthService: PasswordStrengthServiceAbstraction,
    logService: LogService,
    dialogService: DialogService,
    deviceTrustService: DeviceTrustServiceAbstraction,
    userVerificationService: UserVerificationService,
    pinService: PinServiceAbstraction,
    biometricStateService: BiometricStateService,
    biometricsService: BiometricsService,
    accountService: AccountService,
    authService: AuthService,
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
  }

  async ngOnInit() {
    await super.ngOnInit();
    this.autoPromptBiometric = await firstValueFrom(
      this.biometricStateService.promptAutomatically$,
    );

    timer(0, 100)
      .pipe(
        concatMap(async () => {
          return await this.biometricsService.getShouldAutopromptNow();
        }),
        filter((shouldPrompt) => shouldPrompt),
        delay(250),
        throttleTime(5000),
        concatMap(async () => {
          await this.biometricsService.setShouldAutopromptNow(false);
          await this.delayedAskForBiometric(0);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    await this.displayBiometricUpdateWarning();

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowHidden":
            this.onWindowHidden();
            break;
          case "windowIsFocused":
            if (this.deferFocus === null) {
              this.deferFocus = !message.windowIsFocused;
              if (!this.deferFocus) {
                this.focusInput();
              }
            } else if (this.deferFocus && message.windowIsFocused) {
              this.focusInput();
              this.deferFocus = false;
            }
            break;
          default:
        }
      });
    });
    this.messagingService.send("getWindowIsFocused");
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  onWindowHidden() {
    this.showPassword = false;
  }

  private async delayedAskForBiometric(delay: number, params?: any) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (params && !params.promptBiometric) {
      return;
    }

    if (!this.autoPromptBiometric || this.biometricAsked) {
      return;
    }

    if (await firstValueFrom(this.biometricStateService.promptCancelled$)) {
      return;
    }

    this.biometricAsked = true;
    if (await ipc.platform.isWindowVisible()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.unlockBiometric();
    }
  }

  get canUseBiometric() {
    return this.biometricStatus == BiometricsStatus.Available;
  }

  private focusInput() {
    document.getElementById(this.pinEnabled ? "pin" : "masterPassword")?.focus();
  }

  private async displayBiometricUpdateWarning(): Promise<void> {
    if (await firstValueFrom(this.biometricStateService.dismissedRequirePasswordOnStartCallout$)) {
      return;
    }

    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    if (await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)) {
      const response = await this.dialogService.openSimpleDialog({
        title: { key: "windowsBiometricUpdateWarningTitle" },
        content: { key: "windowsBiometricUpdateWarning" },
        type: "warning",
      });

      await this.biometricStateService.setRequirePasswordOnStart(response);
      if (response) {
        await this.biometricStateService.setPromptAutomatically(false);
      }
      await this.biometricStateService.setDismissedRequirePasswordOnStartCallout();
    }
  }

  get biometricText() {
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.MacOsDesktop:
        return "unlockWithTouchId";
      case DeviceType.WindowsDesktop:
        return "unlockWithWindowsHello";
      case DeviceType.LinuxDesktop:
        return "unlockWithPolkit";
      default:
        throw new Error("Unsupported platform");
    }
  }
}
