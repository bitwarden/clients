import { Component, NgZone } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";

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
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { SharedModule } from "../shared";

@Component({
  selector: "app-lock",
  templateUrl: "lock.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class LockComponent extends BaseLockComponent {
  formGroup = this.formBuilder.group({
    masterPassword: ["", Validators.required],
  });

  get masterPasswordFormControl() {
    return this.formGroup.controls.masterPassword;
  }

  constructor(
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected router: Router,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected cryptoService: CryptoService,
    protected vaultTimeoutService: VaultTimeoutService,
    protected vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected apiService: ApiService,
    protected logService: LogService,
    protected ngZone: NgZone,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected policyService: InternalPolicyService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected dialogService: DialogService,
    protected deviceTrustService: DeviceTrustServiceAbstraction,
    protected userVerificationService: UserVerificationService,
    protected pinService: PinServiceAbstraction,
    protected biometricStateService: BiometricStateService,
    protected accountService: AccountService,
    protected authService: AuthService,
    protected kdfConfigService: KdfConfigService,
    protected syncService: SyncService,
    private formBuilder: FormBuilder,
  ) {
    super(
      masterPasswordService,
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
      deviceTrustService,
      userVerificationService,
      pinService,
      biometricStateService,
      accountService,
      authService,
      kdfConfigService,
      syncService,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();

    this.masterPasswordFormControl.setValue(this.masterPassword);

    this.onSuccessfulSubmit = async () => {
      await this.router.navigateByUrl(this.successRoute);
    };
  }

  async superSubmit() {
    await super.submit();
  }

  submit = async () => {
    this.masterPassword = this.masterPasswordFormControl.value;
    await this.superSubmit();
  };
}
