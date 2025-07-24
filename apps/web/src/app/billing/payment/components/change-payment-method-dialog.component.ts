import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, ViewChild } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogConfig, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillingClient } from "../../services";
import { BillableEntity } from "../../types";
import { MaskedPaymentMethod } from "../types";

import { EnterPaymentMethodComponent } from "./enter-payment-method.component";

type DialogParams = {
  owner: BillableEntity;
};

type DialogResult =
  | { type: "cancelled" }
  | { type: "error" }
  | { type: "success"; paymentMethod: MaskedPaymentMethod };

@Component({
  template: `
    <form [formGroup]="formGroup" [bitSubmit]="submit">
      <bit-dialog>
        <span bitDialogTitle class="tw-font-semibold">
          {{ "changePaymentMethod" | i18n }}
        </span>
        <div bitDialogContent>
          <app-enter-payment-method
            [group]="formGroup"
            [showBankAccount]="dialogParams.owner.type !== 'account'"
            [includeBillingAddress]="true"
          >
          </app-enter-payment-method>
        </div>
        <ng-container bitDialogFooter>
          <button bitButton bitFormButton buttonType="primary" type="submit">
            {{ "save" | i18n }}
          </button>
          <button
            bitButton
            buttonType="secondary"
            type="button"
            [bitDialogClose]="{ type: 'cancelled' }"
          >
            {{ "cancel" | i18n }}
          </button>
        </ng-container>
      </bit-dialog>
    </form>
  `,
  standalone: true,
  imports: [EnterPaymentMethodComponent, SharedModule],
  providers: [BillingClient],
})
export class ChangePaymentMethodDialogComponent {
  @ViewChild(EnterPaymentMethodComponent)
  private enterPaymentMethodComponent!: EnterPaymentMethodComponent;
  protected formGroup = EnterPaymentMethodComponent.getFormGroup();

  constructor(
    private billingClient: BillingClient,
    @Inject(DIALOG_DATA) protected dialogParams: DialogParams,
    private dialogRef: DialogRef<DialogResult>,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (!this.formGroup.valid) {
      return;
    }

    const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
    const billingAddress =
      this.formGroup.value.type !== "payPal"
        ? this.formGroup.controls.billingAddress.getRawValue()
        : null;

    const result = await this.billingClient.updatePaymentMethod(
      this.dialogParams.owner,
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

  static open = (dialogService: DialogService, dialogConfig: DialogConfig<DialogParams>) =>
    dialogService.open<DialogResult>(ChangePaymentMethodDialogComponent, dialogConfig);
}
