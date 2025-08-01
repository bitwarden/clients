import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogConfig, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";
import { BillingAddress, getTaxIdTypeForCountry } from "../types";

import { EnterBillingAddressComponent } from "./enter-billing-address.component";

type DialogParams = {
  subscriber: BitwardenSubscriber;
  billingAddress: BillingAddress | null;
};

type DialogResult =
  | { type: "cancelled" }
  | { type: "error" }
  | { type: "success"; billingAddress: BillingAddress };

@Component({
  template: `
    <form [formGroup]="formGroup" [bitSubmit]="submit">
      <bit-dialog>
        <span bitDialogTitle class="tw-font-semibold">
          {{ "editBillingAddress" | i18n }}
        </span>
        <div bitDialogContent>
          <app-enter-billing-address
            [scenario]="{
              type: 'update',
              existing: dialogParams.billingAddress,
              supportsTaxId,
            }"
            [group]="formGroup"
          ></app-enter-billing-address>
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
  imports: [EnterBillingAddressComponent, SharedModule],
  providers: [SubscriberBillingClient],
})
export class EditBillingAddressDialogComponent {
  protected formGroup = EnterBillingAddressComponent.getFormGroup();

  constructor(
    private billingClient: SubscriberBillingClient,
    @Inject(DIALOG_DATA) protected dialogParams: DialogParams,
    private dialogRef: DialogRef<DialogResult>,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {
    if (dialogParams.billingAddress) {
      this.formGroup.patchValue({
        ...dialogParams.billingAddress,
        taxId: dialogParams.billingAddress.taxId?.value,
      });
    }
  }

  submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const { taxId, ...addressFields } = this.formGroup.getRawValue();

    const taxIdType = taxId ? getTaxIdTypeForCountry(addressFields.country) : null;

    const billingAddress = taxIdType
      ? { ...addressFields, taxId: { code: taxIdType.code, value: taxId! } }
      : { ...addressFields, taxId: null };

    const result = await this.billingClient.updateBillingAddress(
      this.dialogParams.subscriber,
      billingAddress,
    );

    switch (result.type) {
      case "success": {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("billingAddressUpdated"),
        });
        this.dialogRef.close({
          type: "success",
          billingAddress: result.value,
        });
        break;
      }
      case "error": {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: result.message,
        });
        this.dialogRef.close({
          type: "error",
        });
        break;
      }
    }
  };

  get supportsTaxId(): boolean {
    switch (this.dialogParams.subscriber.type) {
      case "account": {
        return false;
      }
      case "organization": {
        return [
          ProductTierType.TeamsStarter,
          ProductTierType.Teams,
          ProductTierType.Enterprise,
        ].includes(this.dialogParams.subscriber.data.productTierType);
      }
      case "provider": {
        return true;
      }
    }
  }

  static open = (dialogService: DialogService, dialogConfig: DialogConfig<DialogParams>) =>
    dialogService.open<DialogResult>(EditBillingAddressDialogComponent, dialogConfig);
}
