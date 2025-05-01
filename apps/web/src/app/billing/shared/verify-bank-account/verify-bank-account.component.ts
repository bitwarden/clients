// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";

import { VerifyBankAccountRequest } from "@bitwarden/common/billing/models/request/verify-bank-account.request";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-verify-bank-account",
  templateUrl: "./verify-bank-account.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class VerifyBankAccountComponent {
  @Input() onSubmit?: (request: VerifyBankAccountRequest) => Promise<void>;
  @Output() submitted = new EventEmitter();

  protected formGroup = this.formBuilder.group({
    descriptorCode: new FormControl<string>(null, [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(6),
    ]),
  });

  constructor(private formBuilder: FormBuilder) {}

  submit = async () => {
    const request = new VerifyBankAccountRequest(this.formGroup.value.descriptorCode);
    await this.onSubmit?.(request);
    this.submitted.emit();
  };
}
