import {
  Component,
  EventEmitter,
  Inject,
  OnDestroy,
  OnInit,
  Output,
  resource,
  signal,
  ViewChild,
} from "@angular/core";
import { FormGroup } from "@angular/forms";
import { combineLatest, firstValueFrom, map, Subject, takeUntil } from "rxjs";
import { debounceTime, startWith } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { PaymentMethodType, PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import { ChangePlanFrequencyRequest } from "@bitwarden/common/billing/models/request/change-plan-frequency.request";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import {
  OrganizationPlanChangePreviewRequest,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { DEFAULT_TRIAL_LENGTH_DAYS } from "@bitwarden/web-vault/app/billing/constants";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { BitwardenSubscriber } from "@bitwarden/web-vault/app/billing/types";

import { BillingNotificationService } from "../../services/billing-notification.service";
import { InvoicePreviewService } from "../../services/invoice-preview.service";
import { PlanCardService } from "../../services/plan-card.service";
import { invoicePreviewErrorMessageKey } from "../invoice-preview-error-message-key";
import { PlanCard } from "../plan-card/plan-card.component";

type TrialPaymentDialogParams = {
  organizationId: string;
  subscription: OrganizationSubscriptionResponse;
  productTierType: ProductTierType;
  initialPaymentMethod?: PaymentMethodType;
};

export const TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE = {
  CLOSED: "closed",
  SUBMITTED: "submitted",
} as const;

export type TrialPaymentDialogResultType =
  (typeof TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE)[keyof typeof TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE];

interface OnSuccessArgs {
  organizationId: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-trial-payment-dialog",
  templateUrl: "./trial-payment-dialog.component.html",
  standalone: false,
})
export class TrialPaymentDialogComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent!: EnterPaymentMethodComponent;

  currentPlan!: PlanResponse;
  currentPlanName!: string;
  productTypes = ProductTierType;
  organization!: Organization;
  organizationId!: string;
  sub!: OrganizationSubscriptionResponse;
  selectedInterval: PlanInterval = PlanInterval.Annually;

  readonly planCards = signal<PlanCard[]>([]);
  plans!: ListResponse<PlanResponse>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  protected initialPaymentMethod: PaymentMethodType;
  protected readonly ResultType = TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE;

  formGroup = new FormGroup({
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  private destroy$ = new Subject<void>();

  private readonly planChangeRequest = signal<OrganizationPlanChangePreviewRequest | undefined>(
    undefined,
    {
      equal: (a, b) =>
        a?.tier === b?.tier &&
        a?.cadence === b?.cadence &&
        a?.billingAddress.country === b?.billingAddress.country &&
        a?.billingAddress.postalCode === b?.billingAddress.postalCode &&
        a?.billingAddress.taxId?.code === b?.billingAddress.taxId?.code &&
        a?.billingAddress.taxId?.value === b?.billingAddress.taxId?.value,
    },
  );

  protected readonly planChangeCart = resource({
    params: () => this.planChangeRequest(),
    loader: async ({ params }) => {
      try {
        return await this.invoicePreviewService.previewPlanChangeCart(this.organizationId, params);
      } catch (error) {
        this.billingNotificationService.showError(
          this.i18nService.t(invoicePreviewErrorMessageKey(error)),
        );
        throw error;
      }
    },
  });

  protected get previewErrorMessageKey(): string {
    return invoicePreviewErrorMessageKey(this.planChangeCart.error());
  }

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: TrialPaymentDialogParams,
    private dialogRef: DialogRef<TrialPaymentDialogResultType>,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private accountService: AccountService,
    private planCardService: PlanCardService,
    private apiService: ApiService,
    private toastService: ToastService,
    private organizationBillingApiServiceAbstraction: OrganizationBillingApiServiceAbstraction,
    private subscriberBillingClient: SubscriberBillingClient,
    private invoicePreviewService: InvoicePreviewService,
    private billingNotificationService: BillingNotificationService,
  ) {
    this.initialPaymentMethod = this.dialogParams.initialPaymentMethod ?? PaymentMethodType.Card;
  }

  async ngOnInit(): Promise<void> {
    this.currentPlanName = this.resolvePlanName(this.dialogParams.productTierType);
    this.sub =
      this.dialogParams.subscription ??
      (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
    this.organizationId = this.dialogParams.organizationId;
    if (this.sub?.plan == null) {
      throw new Error("Subscription plan is required");
    }
    this.currentPlan = this.sub.plan;
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (!userId) {
      throw new Error("User ID is required");
    }
    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId)),
    );
    if (!organization) {
      throw new Error("Organization not found");
    }
    this.organization = organization;

    const planCards = await this.planCardService.getCadenceCards(
      this.currentPlan,
      this.sub,
      this.isSecretsManagerTrial(),
    );

    this.planCards.set(planCards);

    if (!this.selectedInterval) {
      this.selectedInterval = planCards.find((card) => card.isSelected)?.isAnnual
        ? PlanInterval.Annually
        : PlanInterval.Monthly;
    }

    const billingAddress = await this.subscriberBillingClient.getBillingAddress({
      type: "organization",
      data: this.organization,
    });

    if (billingAddress) {
      const { taxId, ...location } = billingAddress;

      this.formGroup.controls.billingAddress.patchValue({
        ...location,
        taxId: taxId ? taxId.value : null,
      });
    }

    this.plans = await this.apiService.getPlans();

    combineLatest([
      this.formGroup.controls.billingAddress.controls.country.valueChanges.pipe(
        startWith(this.formGroup.controls.billingAddress.controls.country.value),
      ),
      this.formGroup.controls.billingAddress.controls.postalCode.valueChanges.pipe(
        startWith(this.formGroup.controls.billingAddress.controls.postalCode.value),
      ),
      this.formGroup.controls.billingAddress.controls.taxId.valueChanges.pipe(
        startWith(this.formGroup.controls.billingAddress.controls.taxId.value),
      ),
    ])
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.updatePlanChangeRequest());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<TrialPaymentDialogParams>,
  ) => dialogService.open<TrialPaymentDialogResultType>(TrialPaymentDialogComponent, dialogConfig);

  async setSelected(planCard: PlanCard) {
    this.selectedInterval = planCard.isAnnual ? PlanInterval.Annually : PlanInterval.Monthly;

    this.planCards.update((planCards) => {
      return planCards.map((planCard) => {
        if (planCard.isSelected) {
          return {
            ...planCard,
            isSelected: false,
          };
        } else {
          return {
            ...planCard,
            isSelected: true,
          };
        }
      });
    });

    await this.selectPlan();

    this.updatePlanChangeRequest();
  }

  protected async selectPlan() {
    if (
      this.selectedInterval === PlanInterval.Monthly &&
      this.currentPlan.productTier == ProductTierType.Families
    ) {
      return;
    }

    const filteredPlans = this.plans.data.filter(
      (plan) =>
        plan.productTier === this.currentPlan.productTier &&
        plan.isAnnual === (this.selectedInterval === PlanInterval.Annually),
    );
    if (filteredPlans.length > 0) {
      this.currentPlan = filteredPlans[0];
    }
  }

  private updatePlanChangeRequest() {
    const tier = this.getPlanTier();
    if (this.formGroup.controls.billingAddress.invalid || !tier) {
      this.planChangeRequest.set(undefined);
      return;
    }

    const { country, postalCode, taxId } = getBillingAddressFromForm(
      this.formGroup.controls.billingAddress,
    );

    this.planChangeRequest.set({
      tier,
      cadence:
        this.currentPlan.productTier === ProductTierType.Families || this.currentPlan.isAnnual
          ? "annually"
          : "monthly",
      billingAddress: { country, postalCode, taxId },
    });
  }

  private getPlanTier() {
    switch (this.organization.productTierType) {
      case ProductTierType.Families:
        return "families";
      case ProductTierType.Teams:
        return "teams";
      case ProductTierType.Enterprise:
        return "enterprise";
      default:
        return undefined;
    }
  }

  isSecretsManagerTrial(): boolean {
    return (
      this.sub?.subscription?.items?.some((item) =>
        this.sub?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
  }

  async onSubscribe(): Promise<void> {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    try {
      const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
      if (!paymentMethod) {
        return;
      }

      const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);

      const subscriber: BitwardenSubscriber = { type: "organization", data: this.organization };
      await Promise.all([
        this.subscriberBillingClient.updatePaymentMethod(subscriber, paymentMethod, null),
        this.subscriberBillingClient.updateBillingAddress(subscriber, billingAddress),
      ]);

      if (this.currentPlan.type !== this.sub.planType) {
        const changePlanRequest = new ChangePlanFrequencyRequest();
        changePlanRequest.newPlanType = this.currentPlan.type;
        await this.organizationBillingApiServiceAbstraction.changeSubscriptionFrequency(
          this.organizationId,
          changePlanRequest,
        );
      }

      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("updatedPaymentMethod"),
      });

      this.onSuccess.emit({ organizationId: this.organizationId });
      await this.dialogRef.close(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED);
    } catch (error) {
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : String(error);
      this.toastService.showToast({
        variant: "error",
        title: undefined,
        message: this.i18nService.t(msg) || msg,
      });
    }
  }

  get trialLength(): number {
    const { trialStartDate, trialEndDate } = this.sub?.subscription ?? {};
    if (!trialStartDate || !trialEndDate) {
      return DEFAULT_TRIAL_LENGTH_DAYS;
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round(
      (new Date(trialEndDate).getTime() - new Date(trialStartDate).getTime()) / msPerDay,
    );
  }

  resolvePlanName(productTier: ProductTierType): string {
    switch (productTier) {
      case ProductTierType.Enterprise:
        return this.i18nService.t("planNameEnterprise");
      case ProductTierType.Free:
        return this.i18nService.t("planNameFree");
      case ProductTierType.Families:
        return this.i18nService.t("planNameFamilies");
      case ProductTierType.Teams:
        return this.i18nService.t("planNameTeams");
      case ProductTierType.TeamsStarter:
        return this.i18nService.t("planNameTeamsStarter");
      default:
        return this.i18nService.t("planNameFree");
    }
  }

  get supportsTaxId() {
    if (!this.organization) {
      return false;
    }
    return this.organization.productTierType !== ProductTierType.Families;
  }
}
