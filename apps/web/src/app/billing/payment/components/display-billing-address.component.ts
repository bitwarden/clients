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
  templateUrl: "./display-billing-address.component.html",
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
