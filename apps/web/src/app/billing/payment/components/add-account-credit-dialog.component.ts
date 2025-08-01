import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, ElementRef, Inject, ViewChild } from "@angular/core";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { map } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogConfig, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";

type DialogParams = {
  subscriber: BitwardenSubscriber;
};

type DialogResult = "cancelled" | "error" | "launched";

type PayPalConfig = {
  businessId: string;
  buttonAction: string;
};

declare const process: {
  env: {
    PAYPAL_CONFIG: PayPalConfig;
  };
};

const positiveNumberValidator =
  (message: string): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    const value = parseFloat(control.value);

    if (isNaN(value) || value <= 0) {
      return { notPositiveNumber: { message } };
    }

    return null;
  };

@Component({
  template: `
    <form [formGroup]="formGroup" [bitSubmit]="submit">
      <bit-dialog>
        <span bitDialogTitle class="tw-font-semibold">
          {{ "addCredit" | i18n }}
        </span>
        <div bitDialogContent>
          <p bitTypography="body1">{{ "creditDelayed" | i18n }}</p>
          <div class="tw-grid tw-grid-cols-2">
            <bit-radio-group [formControl]="formGroup.controls.paymentMethod">
              <bit-radio-button id="credit-method-paypal" [value]="'payPal'">
                <bit-label> <i class="bwi bwi-paypal"></i>PayPal</bit-label>
              </bit-radio-button>
              <bit-radio-button id="credit-method-bitcoin" [value]="'bitPay'">
                <bit-label> <i class="bwi bwi-bitcoin"></i>Bitcoin</bit-label>
              </bit-radio-button>
            </bit-radio-group>
          </div>
          <div class="tw-grid tw-grid-cols-2">
            <bit-form-field>
              <bit-label>{{ "amount" | i18n }}</bit-label>
              <input
                bitInput
                [formControl]="formGroup.controls.amount"
                type="text"
                (blur)="formatAmount()"
                required
              />
              <span bitPrefix>$USD</span>
            </bit-form-field>
          </div>
        </div>
        <ng-container bitDialogFooter>
          <button type="submit" bitButton bitFormButton buttonType="primary">
            {{ "submit" | i18n }}
          </button>
          <button
            type="button"
            bitButton
            bitFormButton
            buttonType="secondary"
            [bitDialogClose]="'cancelled'"
          >
            {{ "cancel" | i18n }}
          </button>
        </ng-container>
      </bit-dialog>
    </form>
    <form #payPalForm action="{{ payPalConfig.buttonAction }}" method="post" target="_top">
      <input type="hidden" name="cmd" value="_xclick" />
      <input type="hidden" name="business" value="{{ payPalConfig.businessId }}" />
      <input type="hidden" name="button_subtype" value="services" />
      <input type="hidden" name="no_note" value="1" />
      <input type="hidden" name="no_shipping" value="1" />
      <input type="hidden" name="rm" value="1" />
      <input type="hidden" name="return" value="{{ redirectUrl }}" />
      <input type="hidden" name="cancel_return" value="{{ redirectUrl }}" />
      <input type="hidden" name="currency_code" value="USD" />
      <input
        type="hidden"
        name="image_url"
        value="https://bitwarden.com/images/paypal-banner.png"
      />
      <input type="hidden" name="bn" value="PP-BuyNowBF:btn_buynow_LG.gif:NonHosted" />
      <input type="hidden" name="amount" value="{{ amount }}" />
      <input type="hidden" name="custom" value="{{ payPalCustom$ | async }}" />
      <input type="hidden" name="item_name" value="Bitwarden Account Credit" />
      <input type="hidden" name="item_number" value="{{ payPalSubject }}" />
    </form>
  `,
  standalone: true,
  imports: [SharedModule],
  providers: [SubscriberBillingClient],
})
export class AddAccountCreditDialogComponent {
  @ViewChild("payPalForm", { read: ElementRef, static: true }) payPalForm!: ElementRef;

  protected payPalConfig = process.env.PAYPAL_CONFIG as PayPalConfig;
  protected redirectUrl = window.location.href;

  protected formGroup = new FormGroup({
    paymentMethod: new FormControl<"payPal" | "bitPay">("payPal"),
    amount: new FormControl<string | null>("0.00", [
      Validators.required,
      positiveNumberValidator(this.i18nService.t("mustBePositiveNumber")),
    ]),
  });

  protected payPalCustom$ = this.configService.cloudRegion$.pipe(
    map((cloudRegion) => {
      switch (this.dialogParams.subscriber.type) {
        case "account": {
          return `user_id=${this.dialogParams.subscriber.data.id},account_credit=1,region=${cloudRegion}`;
        }
        case "organization": {
          return `organization_id=${this.dialogParams.subscriber.data.id},account_credit=1,region=${cloudRegion}`;
        }
        case "provider": {
          return `provider_id=${this.dialogParams.subscriber.data.id},account_credit=1,region=${cloudRegion}`;
        }
      }
    }),
  );

  constructor(
    private billingClient: SubscriberBillingClient,
    private configService: ConfigService,
    @Inject(DIALOG_DATA) private dialogParams: DialogParams,
    private dialogRef: DialogRef<DialogResult>,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {}

  submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();

    if (!this.formGroup.valid) {
      return;
    }

    if (this.formGroup.value.paymentMethod === "bitPay") {
      const result = await this.billingClient.addCreditWithBitPay(this.dialogParams.subscriber, {
        amount: this.amount!,
        redirectUrl: this.redirectUrl,
      });

      switch (result.type) {
        case "success": {
          this.platformUtilsService.launchUri(result.value);
          this.dialogRef.close("launched");
          break;
        }
        case "error": {
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: result.message,
          });
          this.dialogRef.close("error");
          break;
        }
      }
    }

    this.payPalForm.nativeElement.submit();
    this.dialogRef.close("launched");
  };

  formatAmount = (): void => {
    if (this.formGroup.value.amount) {
      const amount = parseFloat(this.formGroup.value.amount);
      if (isNaN(amount)) {
        this.formGroup.controls.amount.setValue(null);
      } else {
        this.formGroup.controls.amount.setValue(amount.toFixed(2).toString());
      }
    }
  };

  get amount(): number | null {
    if (this.formGroup.value.amount) {
      const amount = parseFloat(this.formGroup.value.amount);
      if (isNaN(amount)) {
        return null;
      }
      return amount;
    }
    return null;
  }

  get payPalSubject(): string {
    switch (this.dialogParams.subscriber.type) {
      case "account": {
        return this.dialogParams.subscriber.data.email;
      }
      case "organization":
      case "provider": {
        return this.dialogParams.subscriber.data.name;
      }
    }
  }

  static open = (dialogService: DialogService, dialogConfig: DialogConfig<DialogParams>) =>
    dialogService.open<DialogResult>(AddAccountCreditDialogComponent, dialogConfig);
}
