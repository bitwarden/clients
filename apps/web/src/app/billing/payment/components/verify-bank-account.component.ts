import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillingClient } from "../../services";
import { BillableEntity } from "../../types";
import { MaskedPaymentMethod } from "../types";

@Component({
  selector: "app-verify-bank-account",
  templateUrl: "./verify-bank-account.component.html",
  standalone: true,
  imports: [SharedModule],
  providers: [BillingClient],
})
export class VerifyBankAccountComponent {
  @Input({ required: true }) owner!: BillableEntity;
  @Output() verified = new EventEmitter<MaskedPaymentMethod>();

  protected formGroup = new FormGroup({
    descriptorCode: new FormControl<string>("", [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(6),
    ]),
  });

  constructor(
    private billingClient: BillingClient,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();

    if (!this.formGroup.valid) {
      return;
    }

    const result = await this.billingClient.verifyBankAccount(
      this.owner,
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
