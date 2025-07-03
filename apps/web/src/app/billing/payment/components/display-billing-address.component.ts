import { Component, EventEmitter, Input, Output } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillableEntity } from "../../types";
import { AddressPipe } from "../pipes";
import { BillingAddress } from "../types";

import { EditBillingAddressDialogComponent } from "./edit-billing-address-dialog.component";

@Component({
  selector: "app-display-billing-address",
  template: `
    <bit-section>
      <h2 bitTypography="h2">{{ "billingAddress" | i18n }}</h2>
      @if (billingAddress) {
        <p>{{ billingAddress | address }}</p>
        @if (billingAddress.taxId) {
          <p>{{ "taxId" | i18n: billingAddress.taxId.value }}</p>
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
  @Input({ required: true }) owner!: BillableEntity;
  @Input({ required: true }) billingAddress!: BillingAddress | null;
  @Output() updated = new EventEmitter<BillingAddress>();

  constructor(private dialogService: DialogService) {}

  editBillingAddress = async (): Promise<void> => {
    const dialogRef = EditBillingAddressDialogComponent.open(this.dialogService, {
      data: {
        owner: this.owner,
        billingAddress: this.billingAddress,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result?.type === "success") {
      this.updated.emit(result.billingAddress);
    }
  };
}
