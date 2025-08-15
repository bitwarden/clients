import { Component, EventEmitter, Input, Output } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { EditBillingAddressDialogComponent } from "@bitwarden/web-vault/app/billing/payment/components/edit-billing-address-dialog.component";
import { AddressPipe } from "@bitwarden/web-vault/app/billing/payment/pipes";
import { BillingAddress } from "@bitwarden/web-vault/app/billing/payment/types";
import { BitwardenSubscriber } from "@bitwarden/web-vault/app/billing/types";
import {
  TaxIdWarningType,
  TaxIdWarningTypes,
} from "@bitwarden/web-vault/app/billing/warnings/types";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

@Component({
  selector: "app-display-billing-address",
  template: `
    <bit-section>
      <h2 bitTypography="h2">
        {{ "billingAddress" | i18n }}
        @if (showMissingTaxIdBadge) {
          <span bitBadge variant="warning">{{ "missingTaxId" | i18n }}</span>
        }
      </h2>
      @if (billingAddress) {
        <p>{{ billingAddress | address }}</p>
        @if (billingAddress.taxId) {
          <p class="tw-flex tw-items-center tw-gap-2">
            {{ "taxId" | i18n: billingAddress.taxId.value }}
            @if (showTaxIdPendingVerificationBadge) {
              <span bitBadge variant="secondary">{{ "pendingVerification" | i18n }}</span>
            }
            @if (showUnverifiedTaxIdBadge) {
              <span bitBadge variant="warning">{{ "unverified" | i18n }}</span>
            }
          </p>
        }
      } @else {
        <p>{{ "noBillingAddress" | i18n }}</p>
      }
      @let key = billingAddress ? "editBillingAddress" : "addBillingAddress";
      <button type="button" bitButton buttonType="secondary" [bitAction]="editBillingAddress">
        {{ key | i18n }}
      </button>
    </bit-section>
  `,
  standalone: true,
  imports: [AddressPipe, SharedModule],
})
export class DisplayBillingAddressComponent {
  @Input({ required: true }) subscriber!: BitwardenSubscriber;
  @Input({ required: true }) billingAddress!: BillingAddress | null;
  @Input() taxIdWarning?: TaxIdWarningType;
  @Output() updated = new EventEmitter<BillingAddress>();

  constructor(private dialogService: DialogService) {}

  editBillingAddress = async (): Promise<void> => {
    const dialogRef = EditBillingAddressDialogComponent.open(this.dialogService, {
      data: {
        subscriber: this.subscriber,
        billingAddress: this.billingAddress,
        taxIdWarning: this.taxIdWarning,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result?.type === "success") {
      this.updated.emit(result.billingAddress);
    }
  };

  get showMissingTaxIdBadge(): boolean {
    return this.subscriber.type !== "account" && this.taxIdWarning === TaxIdWarningTypes.Missing;
  }

  get showTaxIdPendingVerificationBadge(): boolean {
    return (
      this.subscriber.type !== "account" &&
      this.taxIdWarning === TaxIdWarningTypes.PendingVerification
    );
  }

  get showUnverifiedTaxIdBadge(): boolean {
    return (
      this.subscriber.type !== "account" &&
      this.taxIdWarning === TaxIdWarningTypes.FailedVerification
    );
  }
}
