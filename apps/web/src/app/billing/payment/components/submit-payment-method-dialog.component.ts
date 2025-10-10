import { Component, ViewChild } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, ToastService } from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { BitwardenSubscriber } from "../../types";
import { MaskedPaymentMethod } from "../types";

import { EnterPaymentMethodComponent } from "./enter-payment-method.component";

export type SubmitPaymentMethodDialogResult =
  | { type: "cancelled" }
  | { type: "error" }
  | { type: "success"; paymentMethod: MaskedPaymentMethod };

@Component({ template: "" })
export abstract class SubmitPaymentMethodDialogComponent {
  @ViewChild(EnterPaymentMethodComponent)
  private enterPaymentMethodComponent!: EnterPaymentMethodComponent;
  protected formGroup = EnterPaymentMethodComponent.getFormGroup();

  protected abstract subscriber: BitwardenSubscriber;

  protected constructor(
    protected billingClient: SubscriberBillingClient,
    protected dialogRef: DialogRef<SubmitPaymentMethodDialogResult>,
    protected i18nService: I18nService,
    protected toastService: ToastService,
  ) {}

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (!this.formGroup.valid) {
      return;
    }

    const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
    if (!paymentMethod) {
      return;
    }

    const billingAddress =
      this.formGroup.value.type !== "payPal"
        ? this.formGroup.controls.billingAddress.getRawValue()
        : null;

    const result = await this.billingClient.updatePaymentMethod(
      this.subscriber,
      paymentMethod,
      billingAddress,
    );

    switch (result.type) {
      case "success": {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("paymentMethodUpdated"),
        });
        this.dialogRef.close({
          type: "success",
          paymentMethod: result.value,
        });
        break;
      }
      case "error": {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: result.message,
        });
        this.dialogRef.close({ type: "error" });
        break;
      }
    }
  };
}
