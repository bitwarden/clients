// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TwoFactorRecoveryRequest } from "@bitwarden/common/auth/models/request/two-factor-recovery.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Component({
  selector: "app-recover-two-factor",
  templateUrl: "recover-two-factor.component.html",
})
export class RecoverTwoFactorComponent {
  protected formGroup = new FormGroup({
    email: new FormControl(null, [Validators.required]),
    masterPassword: new FormControl(null, [Validators.required]),
    recoveryCode: new FormControl(null, [Validators.required]),
  });

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private toastService: ToastService,
  ) {}

  get email(): string {
    return this.formGroup.value.email;
  }

  get masterPassword(): string {
    return this.formGroup.value.masterPassword;
  }

  get recoveryCode(): string {
    return this.formGroup.value.recoveryCode;
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const request = new TwoFactorRecoveryRequest();
    request.recoveryCode = this.recoveryCode.replace(/\s/g, "").toLowerCase();
    request.email = this.email.trim().toLowerCase();
    const key = await this.loginStrategyService.makePreloginKey(this.masterPassword, request.email);
    request.masterPasswordHash = await this.keyService.hashMasterKey(this.masterPassword, key);
    await this.apiService.postTwoFactorRecover(request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("twoStepRecoverDisabled"),
    });
    await this.router.navigate(["/"]);
  };
}
