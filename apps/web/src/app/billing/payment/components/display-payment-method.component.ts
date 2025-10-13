import { Component, EventEmitter, Input, Output } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";
import { getCardBrandIcon, MaskedPaymentMethod } from "../types";

import { ChangePaymentMethodDialogComponent } from "./change-payment-method-dialog.component";

@Component({
  selector: "app-display-payment-method",
  template: `
    <bit-section>
      <h2 bitTypography="h2">{{ "paymentMethod" | i18n }}</h2>
      @if (paymentMethod) {
        @switch (paymentMethod.type) {
          @case ("bankAccount") {
            @if (paymentMethod.hostedVerificationUrl) {
              <p>
                {{ "verifyBankAccountWithStripe" | i18n }}
                <a
                  bitLink
                  rel="noreferrer"
                  target="_blank"
                  [attr.href]="paymentMethod.hostedVerificationUrl"
                  >{{ "verifyNow" | i18n }}</a
                >
              </p>
            }

            <p>
              <i class="bwi bwi-fw bwi-billing"></i>
              {{ paymentMethod.bankName }}, *{{ paymentMethod.last4 }}
              @if (paymentMethod.hostedVerificationUrl) {
                <span>- {{ "unverified" | i18n }}</span>
              }
            </p>
          }
          @case ("card") {
            <p class="tw-flex tw-items-center tw-gap-2">
              @let cardBrandIcon = getCardBrandIcon();
              @if (cardBrandIcon !== null) {
                <i class="bwi bwi-fw credit-card-icon {{ cardBrandIcon }}"></i>
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
  imports: [SharedModule],
})
export class DisplayPaymentMethodComponent {
  @Input({ required: true }) subscriber!: BitwardenSubscriber;
  @Input({ required: true }) paymentMethod!: MaskedPaymentMethod | null;
  @Output() updated = new EventEmitter<MaskedPaymentMethod>();

  constructor(private dialogService: DialogService) {}

  changePaymentMethod = async (): Promise<void> => {
    const dialogRef = ChangePaymentMethodDialogComponent.open(this.dialogService, {
      data: {
        subscriber: this.subscriber,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result?.type === "success") {
      this.updated.emit(result.paymentMethod);
    }
  };

  protected getCardBrandIcon = () => getCardBrandIcon(this.paymentMethod);
}
