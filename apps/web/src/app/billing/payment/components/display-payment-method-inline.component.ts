import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService, IconComponent } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";
import { getCardBrandIcon, MaskedPaymentMethod, TokenizablePaymentMethods } from "../types";

import { EnterPaymentMethodComponent } from "./enter-payment-method.component";

/**
 * Component for inline editing of payment methods.
 * Displays a form to update payment method details directly within the parent view.
 */
@Component({
  selector: "app-display-payment-method-inline",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-section>
      @if (!isChangingPayment()) {
        <h5 bitTypography="h5">{{ "paymentMethod" | i18n }}</h5>
        <div class="tw-flex tw-items-center tw-gap-2">
          @if (paymentMethod(); as pm) {
            @switch (pm.type) {
              @case ("bankAccount") {
                @if (pm.hostedVerificationUrl) {
                  <p>
                    {{ "verifyBankAccountWithStripe" | i18n }}
                    <a
                      bitLink
                      rel="noreferrer"
                      target="_blank"
                      [attr.href]="pm.hostedVerificationUrl"
                      >{{ "verifyNow" | i18n }}</a
                    >
                  </p>
                }

                <p>
                  <bit-icon name="bwi-billing"></bit-icon>
                  {{ pm.bankName }}, *{{ pm.last4 }}
                  @if (pm.hostedVerificationUrl) {
                    <span>- {{ "unverified" | i18n }}</span>
                  }
                </p>
              }
              @case ("card") {
                <p class="tw-flex tw-gap-2">
                  @if (cardBrandIcon(); as icon) {
                    <i class="bwi bwi-fw credit-card-icon {{ icon }}"></i>
                  } @else {
                    <bit-icon name="bwi-credit-card"></bit-icon>
                  }
                  {{ pm.brand | titlecase }}, *{{ pm.last4 }},
                  {{ pm.expiration }}
                </p>
              }
              @case ("payPal") {
                <p>
                  <bit-icon name="bwi-paypal" class="tw-text-primary-600"></bit-icon>
                  {{ pm.email }}
                </p>
              }
            }
          } @else {
            <p bitTypography="body1">{{ "noPaymentMethod" | i18n }}</p>
          }
          @let key = paymentMethod() ? "changePaymentMethod" : "addPaymentMethod";
          <a
            bitLink
            linkType="primary"
            class="tw-cursor-pointer tw-mb-4"
            (click)="changePaymentMethod()"
          >
            {{ key | i18n }}</a
          >
        </div>
      } @else {
        <app-enter-payment-method
          #enterPaymentMethodComponent
          [includeBillingAddress]="true"
          [group]="formGroup"
          [showBankAccount]="true"
          [showAccountCredit]="false"
        >
        </app-enter-payment-method>
        <div class="tw-mt-4 tw-flex tw-gap-2">
          <button
            bitLink
            linkType="default"
            type="button"
            (click)="submit()"
            [disabled]="formGroup.invalid"
          >
            {{ "save" | i18n }}
          </button>
          <button bitLink linkType="subtle" type="button" (click)="cancel()">
            {{ "cancel" | i18n }}
          </button>
        </div>
      }
    </bit-section>
  `,
  standalone: true,
  imports: [SharedModule, EnterPaymentMethodComponent, IconComponent],
  providers: [SubscriberBillingClient],
})
export class DisplayPaymentMethodInlineComponent {
  readonly subscriber = input.required<BitwardenSubscriber>();
  readonly paymentMethod = input.required<MaskedPaymentMethod | null>();
  readonly updated = output<MaskedPaymentMethod>();
  readonly changingStateChanged = output<boolean>();

  protected formGroup = EnterPaymentMethodComponent.getFormGroup();

  private readonly enterPaymentMethodComponent = viewChild<EnterPaymentMethodComponent>(
    EnterPaymentMethodComponent,
  );

  protected readonly isChangingPayment = signal(false);
  protected readonly cardBrandIcon = computed(() => getCardBrandIcon(this.paymentMethod()));

  private readonly billingClient = inject(SubscriberBillingClient);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);

  /**
   * Initiates the payment method change process by displaying the inline form.
   */
  protected changePaymentMethod = async (): Promise<void> => {
    this.isChangingPayment.set(true);
    this.changingStateChanged.emit(true);
  };

  /**
   * Submits the payment method update form.
   * Validates the form, tokenizes the payment method, and sends the update request.
   */
  protected submit = async (): Promise<void> => {
    try {
      if (!this.formGroup.valid) {
        this.formGroup.markAllAsTouched();
        throw new Error("Form is invalid");
      }

      const component = this.enterPaymentMethodComponent();
      if (!component) {
        throw new Error("Payment method component not found");
      }

      const paymentMethod = await component.tokenize();
      if (!paymentMethod) {
        throw new Error("Failed to tokenize payment method");
      }

      const billingAddress =
        this.formGroup.value.type !== TokenizablePaymentMethods.payPal
          ? this.formGroup.controls.billingAddress.getRawValue()
          : null;

      await this.handlePaymentMethodUpdate(paymentMethod, billingAddress);
    } catch (error) {
      this.logService.error("Error submitting payment method update:", error);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("paymentMethodUpdateError"),
      });
      throw error;
    }
  };

  /**
   * Handles the payment method update API call and result processing.
   */
  private async handlePaymentMethodUpdate(paymentMethod: any, billingAddress: any): Promise<void> {
    const result = await this.billingClient.updatePaymentMethod(
      this.subscriber(),
      paymentMethod,
      billingAddress,
    );

    switch (result.type) {
      case "success": {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("paymentMethodUpdated"),
        });
        this.updated.emit(result.value);
        this.isChangingPayment.set(false);
        this.changingStateChanged.emit(false);
        this.formGroup.reset();
        break;
      }
      case "error": {
        this.logService.error("Error submitting payment method update:", result);

        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("paymentMethodUpdateError"),
        });
        break;
      }
    }
  }

  /**
   * Cancels the inline editing and resets the form.
   */
  protected cancel = (): void => {
    this.formGroup.reset();
    this.changingStateChanged.emit(false);
    this.isChangingPayment.set(false);
  };
}
