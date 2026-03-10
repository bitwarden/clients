// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  OnDestroy,
  OnInit,
  output,
} from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-email",
  templateUrl: "send-access-email.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAccessEmailComponent implements OnInit, OnDestroy {
  protected readonly formGroup = input.required<FormGroup>();
  protected readonly enterOtp = input.required<boolean>();
  protected email: FormControl;
  protected otp: FormControl;

  readonly resendCode = output<void>();

  readonly loading = input.required<boolean>();
  readonly backToEmail = output<void>();

  constructor(
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    this.email = new FormControl("", Validators.required);
    this.otp = new FormControl("");
    this.formGroup().addControl("email", this.email);
    this.formGroup().addControl("otp", this.otp);

    effect(() => {
      const isOtpMode = this.enterOtp();
      if (isOtpMode) {
        this.email.clearValidators();
      } else {
        this.email.setValidators([Validators.required]);
      }
      this.email.updateValueAndValidity();
    });
  }

  ngOnDestroy() {
    this.formGroup().removeControl("email");
    this.formGroup().removeControl("otp");
  }

  onOtpBlur() {
    if (!this.otp?.value || this.otp.value.trim() === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("verificationCodeRequired"),
      });
    }
  }

  onResendCode() {
    this.resendCode.emit();
  }

  onBackClick() {
    this.backToEmail.emit();
    if (this.otp) {
      this.otp.setValue("");
      this.otp.setErrors(null);
      this.otp.markAsUntouched();
      this.otp.markAsPristine();
    }
  }

  validateEmail(): boolean {
    const value: string = this.email.value?.trim() ?? "";

    if (!value || value.length > 254) {
      return false;
    }

    // RFC 5321-compliant regex: validates local@domain.tld structure
    const EMAIL_REGEX =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

    const [local, ...rest] = value.split("@");

    // Ensure exactly one "@" and local part ≤ 64 chars (RFC 5321)
    if (rest.length !== 1 || local.length > 64) {
      return false;
    }

    return EMAIL_REGEX.test(value);
  }
}
