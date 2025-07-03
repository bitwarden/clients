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
  template: `
    <bit-section>
      <h2 bitTypography="h2">{{ "paymentMethod" | i18n }}</h2>
      @if (paymentMethod) {
        @switch (paymentMethod.type) {
          @case ("bankAccount") {
            @if (!paymentMethod.verified) {
              <app-verify-bank-account [owner]="owner" (verified)="onBankAccountVerified($event)">
              </app-verify-bank-account>
            }

            <p>
              <i class="bwi bwi-fw bwi-billing"></i>
              {{ paymentMethod.bankName }}, *{{ paymentMethod.last4 }}
              @if (!paymentMethod.verified) {
                <span>- {{ "unverified" | i18n }}</span>
              }
            </p>
          }
          @case ("card") {
            <p class="tw-flex tw-items-center tw-gap-2">
              @let brandIcon = getBrandIconForCard();
              @if (brandIcon !== null) {
                <i class="bwi bwi-fw credit-card-icon {{ brandIcon }}"></i>
              } @else {
                <i class="bwi bwi-fw bwi-credit-card"></i>
              }
              {{ paymentMethod.brand | titlecase }}, *{{ paymentMethod.last4 }},
              {{ paymentMethod.expiration }}
            </p>
          }
          @case ("payPal") {
            <p>
              <i class="bwi bwi-fw bwi-paypal tw-text-primary-600"></i>
              {{ paymentMethod.email }}
            </p>
          }
        }
      } @else {
        <p bitTypography="body1">{{ "noPaymentMethod" | i18n }}</p>
      }
      @let key = paymentMethod ? "changePaymentMethod" : "addPaymentMethod";
      <button type="button" bitButton buttonType="secondary" [bitAction]="changePaymentMethod">
        {{ key | i18n }}
      </button>
    </bit-section>
  `,
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
