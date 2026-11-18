import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  resource,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { debounceTime, firstValueFrom, merge } from "rxjs";

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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  LinkModule,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { CartSummaryComponent } from "@bitwarden/pricing";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  OrganizationRestartPreviewRequest,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { BillingNotificationService } from "../services/billing-notification.service";
import { InvoicePreviewService } from "../services/invoice-preview.service";
import { invoicePreviewErrorMessageKey } from "../shared/invoice-preview-error-message-key";

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

const addressEditDebounceMs = 1000;

const isSameRestartRequest = (
  a: OrganizationRestartPreviewRequest | undefined,
  b: OrganizationRestartPreviewRequest | undefined,
): boolean =>
  a?.billingAddress.country === b?.billingAddress.country &&
  a?.billingAddress.postalCode === b?.billingAddress.postalCode &&
  a?.billingAddress.taxId?.code === b?.billingAddress.taxId?.code &&
  a?.billingAddress.taxId?.value === b?.billingAddress.taxId?.value;

@Component({
  templateUrl: "./restart-subscription-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CartSummaryComponent,
    DialogModule,
    EnterBillingAddressComponent,
    EnterPaymentMethodComponent,
    I18nPipe,
    LinkModule,
    ReactiveFormsModule,
    SpinnerComponent,
  ],
})
export class RestartSubscriptionDialogComponent implements OnInit {
  private readonly dialogData = inject<RestartSubscriptionDialogParams>(DIALOG_DATA);
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly subscriberBillingClient = inject(SubscriberBillingClient);
  private readonly billingNotificationService = inject(BillingNotificationService);
  private readonly i18nService = inject(I18nService);
  private readonly invoicePreviewService = inject(InvoicePreviewService);
  private readonly toastService = inject(ToastService);
  private readonly syncService = inject(SyncService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject<DialogRef<RestartSubscriptionDialogResultType>>(DialogRef);
  private readonly organizationWarningsService = inject(OrganizationWarningsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly enterPaymentMethodComponent = viewChild.required(EnterPaymentMethodComponent);

  protected readonly ResultType = RestartSubscriptionDialogResultType;

  protected readonly loading = signal(true);
  protected readonly organization = signal<Organization | undefined>(undefined);
  protected readonly addressLoadFailed = signal(false);
  protected readonly addressReady = signal(false);

  private readonly plans = signal<PlanResponse[] | undefined>(undefined);

  protected readonly restartPlan = computed<PlanResponse | undefined>(() => {
    const plans = this.plans();
    const subscriptionPlan = this.dialogData.subscription.plan;
    if (plans == null || subscriptionPlan == null) {
      return undefined;
    }
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

  protected readonly restartRequest = signal<OrganizationRestartPreviewRequest | undefined>(
    undefined,
    { equal: isSameRestartRequest },
  );

  // The request the form would produce right now, undefined while the address is invalid.
  // Updated on every edit, unlike `restartRequest`, which waits out the debounce.
  private readonly formAddressRequest = signal<OrganizationRestartPreviewRequest | undefined>(
    undefined,
    { equal: isSameRestartRequest },
  );

  protected readonly restartCart = resource({
    params: () => this.restartRequest(),
    loader: async ({ params }) => {
      try {
        return await this.invoicePreviewService.previewRestartCart(
          this.dialogData.organizationId,
          params,
        );
      } catch (error) {
        this.billingNotificationService.showError(
          this.i18nService.t(invoicePreviewErrorMessageKey(error)),
        );
        throw error;
      }
    },
  });

  protected readonly previewErrorMessageKey = computed(() =>
    invoicePreviewErrorMessageKey(this.restartCart.error()),
  );

  // Retrying an address the server rejected would fail the same way; the user has to edit it.
  protected readonly previewRetryable = computed(
    () => this.previewErrorMessageKey() !== "billingPreviewInvalidAddressError",
  );

  protected readonly retryPreview = () => this.restartCart.reload();

  protected readonly restartDisabled = computed(() => {
    const formRequest = this.formAddressRequest();
    return !(
      !this.addressLoadFailed() &&
      this.restartCart.hasValue() &&
      !this.restartCart.isLoading() &&
      formRequest != null &&
      isSameRestartRequest(formRequest, this.restartRequest())
    );
  });

  constructor() {
    const address = this.formGroup.controls.billingAddress;

    address.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formAddressRequest.set(this.buildRestartRequest()));

    merge(
      address.controls.country.valueChanges,
      address.controls.postalCode.valueChanges,
      address.controls.taxId.valueChanges,
    )
      .pipe(debounceTime(addressEditDebounceMs), takeUntilDestroyed())
      .subscribe(() => {
        const request = this.buildRestartRequest();
        if (this.addressReady() && request != null) {
          this.restartRequest.set(request);
        }
      });
  }

  async ngOnInit(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.dialogData.organizationId)),
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
      this.restartRequest.set(this.buildRestartRequest());
    } catch (error) {
      this.addressLoadFailed.set(true);
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly submit = async (): Promise<void> => {
    const organization = this.organization();
    if (organization == null) {
      throw new Error("Cannot restart a subscription before the organization has loaded.");
    }

    const paymentMethod = await this.enterPaymentMethodComponent().tokenize();
    if (paymentMethod == null) {
      return;
    }

    await this.subscriberBillingClient.restartSubscription(
      { type: "organization", data: organization },
      paymentMethod,
      getBillingAddressFromForm(this.formGroup.controls.billingAddress),
    );
    this.organizationWarningsService.refreshInactiveSubscriptionWarning();

    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("restartOrganizationSubscription"),
    });
    await this.syncService.fullSync(true);
    await this.router.navigate([
      `/organizations/${this.dialogData.organizationId}/billing/subscription`,
    ]);
    await this.dialogRef.close(RestartSubscriptionDialogResultType.Submitted);
  };

  private buildRestartRequest(): OrganizationRestartPreviewRequest | undefined {
    const address = this.formGroup.controls.billingAddress;
    if (!address.valid) {
      return undefined;
    }
    const { country, postalCode, taxId } = getBillingAddressFromForm(address);
    return { billingAddress: { country, postalCode, taxId } };
  }
}
