// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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

  readonly loading = input.required<boolean>();
  readonly backToEmail = output<void>();

  constructor() {}

  ngOnInit() {
    this.email = new FormControl("", Validators.required);
    this.otp = new FormControl("");
    this.formGroup().addControl("email", this.email);
    this.formGroup().addControl("otp", this.otp);

    // Update validators when enterOtp changes
    effect(() => {
      const isOtpMode = this.enterOtp();
      if (isOtpMode) {
        // In OTP mode: email is not required (already entered), otp is required
        this.email.clearValidators();
        this.otp.setValidators([Validators.required]);
      } else {
        // In email mode: email is required, otp is not required
        this.email.setValidators([Validators.required]);
        this.otp.clearValidators();
      }
      this.email.updateValueAndValidity();
      this.otp.updateValueAndValidity();
    });
  }
  ngOnDestroy() {
    this.formGroup().removeControl("email");
    this.formGroup().removeControl("otp");
  }

  onBackClick() {
    this.backToEmail.emit();
    if (this.otp) {
      this.otp.clearValidators();
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
