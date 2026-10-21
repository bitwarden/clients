import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { BillingNotificationService } from "../services/billing-notification.service";

export type RestartSubscriptionDialogParams = {
  organizationId: string;
  subscription: OrganizationSubscriptionResponse;
};

export const RestartSubscriptionDialogResultType = Object.freeze({
  Closed: "closed",
  Submitted: "submitted",
} as const);

export type RestartSubscriptionDialogResultType =
  (typeof RestartSubscriptionDialogResultType)[keyof typeof RestartSubscriptionDialogResultType];

export const openRestartSubscriptionDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<RestartSubscriptionDialogParams>,
) =>
  dialogService.open<RestartSubscriptionDialogResultType, RestartSubscriptionDialogParams>(
    RestartSubscriptionDialogComponent,
    dialogConfig,
  );

@Component({
  templateUrl: "./restart-subscription-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    EnterBillingAddressComponent,
    EnterPaymentMethodComponent,
    I18nPipe,
    ReactiveFormsModule,
  ],
})
export class RestartSubscriptionDialogComponent implements OnInit {
  private readonly params = inject<RestartSubscriptionDialogParams>(DIALOG_DATA);
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly subscriberBillingClient = inject(SubscriberBillingClient);
  private readonly billingNotificationService = inject(BillingNotificationService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly ResultType = RestartSubscriptionDialogResultType;

  protected readonly loading = signal(true);
  protected readonly organization = signal<Organization | undefined>(undefined);
  protected readonly addressLoadFailed = signal(false);
  protected readonly addressReady = signal(false);

  private readonly plans = signal<PlanResponse[] | undefined>(undefined);

  protected readonly restartPlan = computed<PlanResponse | undefined>(() => {
    const plans = this.plans();
    if (plans == null) {
      return undefined;
    }
    const subscriptionPlan = this.params.subscription.plan;
    if (!subscriptionPlan.disabled) {
      return subscriptionPlan;
    }
    return (
      plans.find(
        (plan) =>
          plan.productTier === subscriptionPlan.productTier &&
          plan.isAnnual === subscriptionPlan.isAnnual &&
          !plan.disabled,
      ) ?? subscriptionPlan
    );
  });

  protected readonly supportsTaxId = computed(
    () => this.restartPlan()?.productTier !== ProductTierType.Families,
  );

  protected readonly formGroup = this.formBuilder.group({
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  async ngOnInit(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.params.organizationId)),
      );
      if (organization == null) {
        throw new Error("Organization not found");
      }

      const [plans, billingAddress] = await Promise.all([
        this.apiService.getPlans(),
        this.subscriberBillingClient.getBillingAddress({
          type: "organization",
          data: organization,
        }),
      ]);

      this.organization.set(organization);
      this.plans.set(plans.data.filter((plan) => !!plan.PasswordManager));
      if (billingAddress != null) {
        this.formGroup.controls.billingAddress.patchValue({
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
          line1: billingAddress.line1,
          line2: billingAddress.line2,
          city: billingAddress.city,
          state: billingAddress.state,
          taxId: billingAddress.taxId?.value ?? "",
        });
      }
      this.addressReady.set(true);
    } catch (error) {
      this.addressLoadFailed.set(true);
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading.set(false);
    }
  }
}
