import { CurrencyPipe } from "@angular/common";
import { Component, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";

import { AddAccountCreditDialogComponent } from "./add-account-credit-dialog.component";

@Component({
  selector: "app-display-account-credit",
  template: `
    <bit-section>
      <h2 bitTypography="h2">{{ "accountCredit" | i18n }}: {{ formattedCredit }}</h2>
      <p>{{ "availableCreditAppliedToInvoice" | i18n }}</p>
      <button type="button" bitButton buttonType="secondary" [bitAction]="addAccountCredit">
        {{ "addCredit" | i18n }}
      </button>
    </bit-section>
  `,
  standalone: true,
  imports: [SharedModule],
  providers: [SubscriberBillingClient, CurrencyPipe],
})
export class DisplayAccountCreditComponent {
  @Input({ required: true }) subscriber!: BitwardenSubscriber;
  @Input({ required: true }) credit!: number | null;

  constructor(
    private billingClient: SubscriberBillingClient,
    private currencyPipe: CurrencyPipe,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  addAccountCredit = async () => {
    if (this.subscriber.type !== "account") {
      const billingAddress = await this.billingClient.getBillingAddress(this.subscriber);
      if (!billingAddress) {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("billingAddressRequiredToAddCredit"),
        });
      }
    }

    AddAccountCreditDialogComponent.open(this.dialogService, {
      data: {
        subscriber: this.subscriber,
      },
    });
  };

  get formattedCredit(): string | null {
    const credit = this.credit ?? 0;
    return this.currencyPipe.transform(credit, "$");
  }
}
