import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CalloutTypes,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { BillingAddress } from "@bitwarden/web-vault/app/billing/payment/types";
import { BitwardenSubscriber } from "@bitwarden/web-vault/app/billing/types";
import {
  TaxIdWarningType,
  TaxIdWarningTypes,
} from "@bitwarden/web-vault/app/billing/warnings/types";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  EnterBillingAddressComponent,
  getBillingAddressFromForm,
} from "./enter-billing-address.component";

type DialogParams = {
  subscriber: BitwardenSubscriber;
  billingAddress: BillingAddress | null;
  taxIdWarning?: TaxIdWarningType;
};

type DialogResult =
  | { type: "cancelled" }
  | { type: "error" }
  | { type: "success"; billingAddress: BillingAddress };

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <form [formGroup]="formGroup" [bitSubmit]="submit">
      <bit-dialog>
        <span bitDialogTitle class="tw-font-semibold">
          {{ "editBillingAddress" | i18n }}
        </span>
        <div bitDialogContent>
          @let callout = taxIdWarningCallout;
          @if (callout) {
            <bit-callout [type]="callout.type" [title]="callout.title">
              {{ callout.message }}
            </bit-callout>
          }
          <app-enter-billing-address
            [scenario]="{
              type: 'update',
              existing: dialogParams.billingAddress,
              supportsTaxId,
              taxIdWarning: dialogParams.taxIdWarning,
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

    const billingAddress = getBillingAddressFromForm(this.formGroup);

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

  get taxIdWarningCallout(): {
    type: CalloutTypes;
    title: string;
    message: string;
  } | null {
    if (
      !this.supportsTaxId ||
      !this.dialogParams.taxIdWarning ||
      this.dialogParams.taxIdWarning === TaxIdWarningTypes.PendingVerification
    ) {
      return null;
    }

    switch (this.dialogParams.taxIdWarning) {
      case TaxIdWarningTypes.Missing: {
        return {
          type: "warning",
          title: this.i18nService.t("missingTaxIdCalloutTitle"),
          message: this.i18nService.t("missingTaxIdCalloutDescription"),
        };
      }
      case TaxIdWarningTypes.FailedVerification: {
        return {
          type: "warning",
          title: this.i18nService.t("unverifiedTaxIdCalloutTitle"),
          message: this.i18nService.t("unverifiedTaxIdCalloutDescription"),
        };
      }
    }
  }

  static open = (dialogService: DialogService, dialogConfig: DialogConfig<DialogParams>) =>
    dialogService.open<DialogResult>(EditBillingAddressDialogComponent, dialogConfig);
}
