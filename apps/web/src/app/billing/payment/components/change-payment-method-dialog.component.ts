import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogConfig, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { SubscriberBillingClient } from "../../services";
import { BitwardenSubscriber } from "../../types";

import { EnterPaymentMethodComponent } from "./enter-payment-method.component";
import {
  SubmitPaymentMethodDialogComponent,
  SubmitPaymentMethodDialogResult,
} from "./submit-payment-method-dialog.component";

type DialogParams = {
  subscriber: BitwardenSubscriber;
};

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
            [showBankAccount]="dialogParams.subscriber.type !== 'account'"
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
  providers: [SubscriberBillingClient],
})
export class ChangePaymentMethodDialogComponent extends SubmitPaymentMethodDialogComponent {
  protected override subscriber: BitwardenSubscriber;

  constructor(
    billingClient: SubscriberBillingClient,
    @Inject(DIALOG_DATA) protected dialogParams: DialogParams,
    dialogRef: DialogRef<SubmitPaymentMethodDialogResult>,
    i18nService: I18nService,
    toastService: ToastService,
  ) {
    super(billingClient, dialogRef, i18nService, toastService);
    this.subscriber = this.dialogParams.subscriber;
  }

  static open = (dialogService: DialogService, dialogConfig: DialogConfig<DialogParams>) =>
    dialogService.open<SubmitPaymentMethodDialogResult>(
      ChangePaymentMethodDialogComponent,
      dialogConfig,
    );
}
