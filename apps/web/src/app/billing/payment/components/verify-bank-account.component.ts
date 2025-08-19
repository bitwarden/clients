import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";
import { MaskedPaymentMethod } from "../types";

@Component({
  selector: "app-verify-bank-account",
  template: `
    <bit-callout type="warning" title="{{ 'verifyBankAccount' | i18n }}">
      <p>{{ "verifyBankAccountWithStatementDescriptorInstructions" | i18n }}</p>
      <form [formGroup]="formGroup" [bitSubmit]="submit">
        <bit-form-field class="tw-mr-2 tw-w-48">
          <bit-label>{{ "descriptorCode" | i18n }}</bit-label>
          <input
            bitInput
            type="text"
            placeholder="SMAB12"
            [formControl]="formGroup.controls.descriptorCode"
          />
        </bit-form-field>
        <button type="submit" bitButton bitFormButton buttonType="primary">
          {{ "submit" | i18n }}
        </button>
      </form>
    </bit-callout>
  `,
  standalone: true,
  imports: [SharedModule],
  providers: [SubscriberBillingClient],
})
export class VerifyBankAccountComponent {
  @Input({ required: true }) subscriber!: BitwardenSubscriber;
  @Output() verified = new EventEmitter<MaskedPaymentMethod>();

  protected formGroup = new FormGroup({
    descriptorCode: new FormControl<string>("", [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(6),
    ]),
  });

  constructor(
    private billingClient: SubscriberBillingClient,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();

    if (!this.formGroup.valid) {
      return;
    }

    const result = await this.billingClient.verifyBankAccount(
      this.subscriber,
      this.formGroup.value.descriptorCode!,
    );

    switch (result.type) {
      case "success": {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("bankAccountVerified"),
        });
        this.verified.emit(result.value);
        break;
      }
      case "error": {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: result.message,
        });
      }
    }
  };
}
