import { Component, EventEmitter, Input, Output } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillableEntity } from "../../types";
import { MaskedPaymentMethod } from "../types";

import { ChangePaymentMethodDialogComponent } from "./change-payment-method-dialog.component";
import { VerifyBankAccountComponent } from "./verify-bank-account.component";

@Component({
  selector: "app-display-payment-method",
  templateUrl: "./display-payment-method.component.html",
  standalone: true,
  imports: [SharedModule, VerifyBankAccountComponent],
})
export class DisplayPaymentMethodComponent {
  @Input({ required: true }) owner!: BillableEntity;
  @Input({ required: true }) paymentMethod!: MaskedPaymentMethod | null;
  @Output() updated = new EventEmitter<MaskedPaymentMethod>();

  protected availableCardIcons: Record<string, string> = {
    amex: "card-amex",
    diners: "card-diners-club",
    discover: "card-discover",
    jcb: "card-jcb",
    mastercard: "card-mastercard",
    unionpay: "card-unionpay",
    visa: "card-visa",
  };

  constructor(private dialogService: DialogService) {}

  changePaymentMethod = async (): Promise<void> => {
    const dialogRef = ChangePaymentMethodDialogComponent.open(this.dialogService, {
      data: {
        owner: this.owner,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result?.type === "success") {
      this.updated.emit(result.paymentMethod);
    }
  };

  onBankAccountVerified = (paymentMethod: MaskedPaymentMethod) => this.updated.emit(paymentMethod);

  protected getBrandIconForCard = (): string | null => {
    if (this.paymentMethod?.type !== "card") {
      return null;
    }

    return this.paymentMethod.brand in this.availableCardIcons
      ? this.availableCardIcons[this.paymentMethod.brand]
      : null;
  };
}
