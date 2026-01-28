// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, input, OnDestroy, OnInit } from "@angular/core";
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

  constructor() {}

  ngOnInit() {
    this.email = new FormControl("", Validators.required);
    this.otp = new FormControl("", Validators.required);
    this.formGroup().addControl("email", this.email);
    this.formGroup().addControl("otp", this.otp);
  }

  ngOnDestroy() {
    this.formGroup().removeControl("email");
    this.formGroup().removeControl("otp");
  }
}
