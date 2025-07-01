import { CurrencyPipe } from "@angular/common";
import { Component, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillingClient } from "../../services";
import { BillableEntity } from "../../types";

import { AddAccountCreditDialogComponent } from "./add-account-credit-dialog.component";

@Component({
  selector: "app-display-account-credit",
  templateUrl: "./display-account-credit.component.html",
  standalone: true,
  imports: [SharedModule],
  providers: [BillingClient, CurrencyPipe],
})
export class DisplayAccountCreditComponent {
  @Input({ required: true }) owner!: BillableEntity;
  @Input({ required: true }) credit!: number | null;

  constructor(
    private billingClient: BillingClient,
    private currencyPipe: CurrencyPipe,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  addAccountCredit = async () => {
    if (this.owner.type !== "account") {
      const billingAddress = await this.billingClient.getBillingAddress(this.owner);
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
        owner: this.owner,
      },
    });
  };

  get formattedCredit(): string | null {
    const credit = this.credit ?? 0;
    return this.currencyPipe.transform(credit, "$");
  }
}
