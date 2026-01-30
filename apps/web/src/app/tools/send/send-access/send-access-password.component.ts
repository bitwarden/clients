// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-password",
  templateUrl: "send-access-password.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAccessPasswordComponent implements OnInit, OnDestroy {
  protected readonly formGroup = input.required<FormGroup>();
  protected password: FormControl;

  readonly loading = input.required<boolean>();

  constructor() {}

  ngOnInit() {
    this.password = new FormControl("", Validators.required);
    this.formGroup().addControl("password", this.password);
  }

  ngOnDestroy() {
    this.formGroup().removeControl("password");
  }
}
