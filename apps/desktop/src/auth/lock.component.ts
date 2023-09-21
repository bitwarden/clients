import { Component, NgZone } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ipcRenderer } from "electron";

import { LockComponent as BaseLockComponent } from "@bitwarden/angular/auth/components/lock.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { DeviceType, KeySuffixOptions } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { DialogService } from "@bitwarden/components";

import { ElectronStateService } from "../platform/services/electron-state.service.abstraction";
import { BiometricStorageAction, BiometricMessage } from "../types/biometric-message";

const BroadcasterSubscriptionId = "LockComponent";

@Component({
  selector: "app-lock",
  templateUrl: "lock.component.html",
})
export class LockComponent extends BaseLockComponent {
  private deferFocus: boolean = null;
  protected biometricReady = false;

  constructor(
    router: Router,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    cryptoService: CryptoService,
    vaultTimeoutService: VaultTimeoutService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    environmentService: EnvironmentService,
    protected override stateService: ElectronStateService,
    apiService: ApiService,
    private route: ActivatedRoute,
    private broadcasterService: BroadcasterService,
    ngZone: NgZone,
    policyApiService: PolicyApiServiceAbstraction,
    policyService: InternalPolicyService,
    passwordStrengthService: PasswordStrengthServiceAbstraction,
    logService: LogService,
    dialogService: DialogService,
    deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    userVerificationService: UserVerificationService
  ) {
    super(
      router,
      i18nService,
      platformUtilsService,
      messagingService,
      cryptoService,
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
      deviceTrustCryptoService,
      userVerificationService
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    const autoPromptBiometric = !(await this.stateService.getDisableAutoBiometricsPrompt());
    this.biometricReady = await this.canUseBiometric();

    await this.displayBiometricUpdateWarning();

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.queryParams.subscribe((params) => {
      setTimeout(async () => {
        if (!params.promptBiometric || !this.supportsBiometric || !autoPromptBiometric) {
          return;
        }

        if (await ipcRenderer.invoke("windowVisible")) {
          this.unlockBiometric();
        }
      }, 1000);
    });
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

  private async canUseBiometric() {
    const userId = await this.stateService.getUserId();
    const val = await ipcRenderer.invoke("biometric", {
      action: BiometricStorageAction.EnabledForUser,
      key: `${userId}_user_biometric`,
      keySuffix: KeySuffixOptions.Biometric,
      userId: userId,
    } as BiometricMessage);
    return val != null ? (JSON.parse(val) as boolean) : null;
  }

  private focusInput() {
    document.getElementById(this.pinEnabled ? "pin" : "masterPassword")?.focus();
  }

  private async displayBiometricUpdateWarning(): Promise<void> {
    if (await this.stateService.getDismissedBiometricRequirePasswordOnStart()) {
      return;
    }

    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    if (await this.stateService.getBiometricUnlock()) {
      const response = await this.dialogService.openSimpleDialog({
        title: { key: "windowsBiometricUpdateWarningTitle" },
        content: { key: "windowsBiometricUpdateWarning" },
        type: "warning",
      });

      await this.stateService.setBiometricRequirePasswordOnStart(response);
      if (response) {
        await this.stateService.setDisableAutoBiometricsPrompt(true);
      }
      this.supportsBiometric = await this.canUseBiometric();
      await this.stateService.setDismissedBiometricRequirePasswordOnStart();
    }
  }
}
