// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, lastValueFrom, Subject } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { GearIcon } from "@bitwarden/assets/svg";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationApiKeyType,
  OrganizationUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { BillingSubscriptionItemResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { DiscountTypes, getAmount } from "@bitwarden/pricing";

import { OrganizationBillingClient } from "../clients";
import {
  AdjustStorageDialogComponent,
  AdjustStorageDialogResultType,
} from "../shared/adjust-storage-dialog/adjust-storage-dialog.component";
import {
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "../shared/offboarding-survey.component";

import { BillingSyncApiKeyComponent } from "./billing-sync-api-key.component";
import { ChangePlanDialogResultType, openChangePlanDialog } from "./change-plan-dialog.component";
import {
  ChurnMitigationOfferDialogComponent,
  ChurnMitigationOfferDialogResultType,
} from "./churn-mitigation-offer-dialog.component";
import { DownloadLicenceDialogComponent } from "./download-license.component";
import { SecretsManagerSubscriptionOptions } from "./sm-adjust-subscription.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "organization-subscription-cloud.component.html",
  standalone: false,
})
export class OrganizationSubscriptionCloudComponent implements OnInit, OnDestroy {
  static readonly QUERY_PARAM_UPGRADE: string = "upgrade";
  static readonly ROUTE_PARAM_ORGANIZATION_ID: string = "organizationId";

  sub: OrganizationSubscriptionResponse;
  lineItems: BillingSubscriptionItemResponse[] = [];
  organizationId: string;
  userOrg: Organization;
  showChangePlan = false;
  hasBillingSyncToken: boolean;
  showAdjustSecretsManager = false;
  showSecretsManagerSubscribe = false;
  loading = true;
  locale: string;
  preSelectedProductTier: ProductTierType = ProductTierType.Free;
  showSubscription = true;
  showSelfHost = false;
  organizationIsManagedByConsolidatedBillingMSP = false;
  resellerSeatsRemainingMessage: string;
  isResellerOrganizationOwnerExempt: boolean;

  protected readonly gearIcon = GearIcon;
  protected readonly teamsStarter = ProductTierType.TeamsStarter;

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private toastService: ToastService,
    private organizationUserApiService: OrganizationUserApiService,
    private organizationBillingClient: OrganizationBillingClient,
  ) {}

  async ngOnInit() {
    this.organizationId =
      this.route.snapshot.params[
        OrganizationSubscriptionCloudComponent.ROUTE_PARAM_ORGANIZATION_ID
      ];
    await this.load();

    if (
      this.route.snapshot.queryParams[OrganizationSubscriptionCloudComponent.QUERY_PARAM_UPGRADE]
    ) {
      await this.changePlan();
      const productTierTypeStr = this.route.snapshot.queryParamMap.get("productTierType");
      if (productTierTypeStr != null) {
        const productTier = Number(productTierTypeStr);
        if (Object.values(ProductTierType).includes(productTier as ProductTierType)) {
          this.preSelectedProductTier = productTier;
        }
      }
    }

    if (this.userOrg.hasReseller) {
      const allUsers = await this.organizationUserApiService.getAllUsers(this.userOrg.id);

      const userCount = allUsers.data.filter((user) =>
        [
          OrganizationUserStatusType.Invited,
          OrganizationUserStatusType.Accepted,
          OrganizationUserStatusType.Confirmed,
        ].includes(user.status),
      ).length;

      const remainingSeats = this.userOrg.seats - userCount;

      const seatsRemaining = this.i18nService.t(
        "seatsRemaining",
        remainingSeats.toString(),
        this.userOrg.seats.toString(),
      );

      this.resellerSeatsRemainingMessage = seatsRemaining;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    this.loading = true;
    this.locale = await firstValueFrom(this.i18nService.locale$);
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.userOrg = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId)),
    );

    const isIndependentOrganizationOwner = !this.userOrg.hasProvider && this.userOrg.isOwner;
    const isResoldOrganizationOwner = this.userOrg.hasReseller && this.userOrg.isOwner;
    const isMSPUser = this.userOrg.hasProvider && this.userOrg.isProviderUser;

    this.organizationIsManagedByConsolidatedBillingMSP =
      this.userOrg.hasProvider && this.userOrg.hasBillableProvider;

    this.showSubscription =
      isIndependentOrganizationOwner ||
      isResoldOrganizationOwner ||
      (isMSPUser && !this.organizationIsManagedByConsolidatedBillingMSP);

    this.showSelfHost =
      this.userOrg.productTierType === ProductTierType.Families ||
      this.userOrg.productTierType === ProductTierType.Enterprise;

    if (this.showSubscription) {
      this.sub = await this.organizationApiService.getSubscription(this.organizationId);
      this.lineItems = this.sub?.subscription?.items;

      if (this.lineItems && this.lineItems.length) {
        this.lineItems = this.lineItems
          .map((item) => {
            const itemTotalAmount = item.amount * item.quantity;
            const seatPriceTotal = this.sub.plan?.SecretsManager?.seatPrice * item.quantity;
            item.productName =
              itemTotalAmount === seatPriceTotal || item.name.includes("Service Accounts")
                ? "secretsManager"
                : "passwordManager";
            return item;
          })
          .sort(sortSubscriptionItems);
      }

      if (this.sub?.customerDiscount?.percentOff == 100) {
        this.lineItems.reverse();
      }
    }

    const apiKeyResponse = await this.organizationApiService.getApiKeyInformation(
      this.organizationId,
    );
    this.hasBillingSyncToken = apiKeyResponse.data.some(
      (i) => i.keyType === OrganizationApiKeyType.BillingSync,
    );

    this.showSecretsManagerSubscribe =
      this.userOrg.canEditSubscription &&
      !this.userOrg.hasProvider &&
      this.sub?.plan?.SecretsManager &&
      !this.userOrg.useSecretsManager &&
      !this.subscription?.cancelled &&
      !this.subscriptionMarkedForCancel;

    this.showAdjustSecretsManager =
      this.userOrg.canEditSubscription &&
      this.userOrg.useSecretsManager &&
      this.subscription != null &&
      this.sub.plan?.SecretsManager?.hasAdditionalSeatsOption &&
      !this.subscription.cancelled &&
      !this.subscriptionMarkedForCancel;

    this.isResellerOrganizationOwnerExempt =
      this.userOrg.hasReseller && !!this.sub?.exemptFromBillingAutomation;

    this.loading = false;
  }

  get subscription() {
    return this.sub != null ? this.sub.subscription : null;
  }

  get subscriptionLineItems() {
    // A fixed `amountOff` applies once to the subscription total, so it is consumed across the
    // ordered line items rather than subtracted from each line independently. Compute the discounted
    // line totals up front to track that running balance.
    const discountedTotals = this.discountedLineTotals();
    return this.lineItems.map((lineItem: BillingSubscriptionItemResponse, index: number) => ({
      name: lineItem.name,
      originalAmount: lineItem.amount,
      amount: this.discountPrice(lineItem.amount, lineItem.productId),
      discountedTotal: discountedTotals[index],
      // True only when this line's total was actually reduced. A fixed amount-off consumed in full by
      // earlier lines leaves later lines undiscounted, so they must not render a strikethrough/qualifier.
      discounted: discountedTotals[index] < lineItem.quantity * lineItem.amount,
      quantity: lineItem.quantity,
      interval: lineItem.interval,
      sponsoredSubscriptionItem: lineItem.sponsoredSubscriptionItem,
      addonSubscriptionItem: lineItem.addonSubscriptionItem,
      productName: lineItem.productName,
      productId: lineItem.productId,
    }));
  }

  /**
   * Discounted total for each line item, aligned by index with `lineItems`.
   *
   * The percentage discount scales per unit, so each line total is `quantity × discounted unit`.
   * A fixed `amountOff` applies once to the whole subscription, so it is subtracted from the running
   * total across the applicable lines (clamped at 0) — never multiplied across lines.
   */
  private discountedLineTotals(): number[] {
    const customerDiscount = this.customerDiscount;
    let remainingAmountOff = customerDiscount?.amountOff ?? 0;

    return this.lineItems.map((lineItem) => {
      const lineTotal = lineItem.quantity * lineItem.amount;

      if (remainingAmountOff > 0 && this.discountAppliesToProduct(lineItem.productId)) {
        const applied = Math.min(remainingAmountOff, lineTotal);
        remainingAmountOff -= applied;
        return lineTotal - applied;
      }

      return lineItem.quantity * this.discountPrice(lineItem.amount, lineItem.productId);
    });
  }

  get nextInvoice() {
    return this.sub != null ? this.sub.upcomingInvoice : null;
  }

  get customerDiscount() {
    return this.sub != null ? this.sub.customerDiscount : null;
  }

  get isExpired() {
    const nextInvoice = this.nextInvoice;

    if (nextInvoice == null) {
      return false;
    }

    return new Date(nextInvoice.date).getTime() < Date.now();
  }

  get storagePercentage() {
    return this.sub != null && this.sub.maxStorageGb
      ? +(100 * (this.sub.storageGb / this.sub.maxStorageGb)).toFixed(2)
      : 0;
  }

  get billingInterval() {
    const monthly = !this.sub.plan.isAnnual;
    return monthly ? "month" : "year";
  }

  get storageGbPrice() {
    return this.sub.plan.PasswordManager.additionalStoragePricePerGb;
  }

  get seatPrice() {
    return this.discountPrice(this.sub.plan.PasswordManager.seatPrice);
  }

  get seats() {
    return this.sub.seats;
  }

  get smOptions(): SecretsManagerSubscriptionOptions {
    return {
      seatCount: this.sub.smSeats,
      maxAutoscaleSeats: this.sub.maxAutoscaleSmSeats,
      seatPrice: this.sub.plan.SecretsManager.seatPrice,
      maxAutoscaleServiceAccounts: this.sub.maxAutoscaleSmServiceAccounts,
      additionalServiceAccounts: Math.max(
        0,
        this.sub.smServiceAccounts -
          this.sub.plan.SecretsManager.baseServiceAccount -
          (this.sub.smServiceAccountsGrace ?? 0),
      ),
      interval: this.sub.plan.isAnnual ? "year" : "month",
      additionalServiceAccountPrice: this.sub.plan.SecretsManager.additionalPricePerServiceAccount,
      baseServiceAccountCount: this.sub.plan.SecretsManager.baseServiceAccount,
      graceServiceAccounts: this.sub.smServiceAccountsGrace ?? 0,
    };
  }

  get maxAutoscaleSeats() {
    return this.sub.maxAutoscaleSeats;
  }

  get canAdjustSeats() {
    return this.sub.plan.PasswordManager.hasAdditionalSeatsOption;
  }

  get isSponsoredSubscription(): boolean {
    return this.sub.subscription?.items.some((i) => i.sponsoredSubscriptionItem);
  }

  get subscriptionDesc() {
    if (this.sub.planType === PlanType.Free) {
      return this.i18nService.t("subscriptionFreePlan", this.sub.seats.toString());
    } else if (
      this.sub.planType === PlanType.FamiliesAnnually ||
      this.sub.planType === PlanType.FamiliesAnnually2025 ||
      this.sub.planType === PlanType.FamiliesAnnually2019 ||
      this.sub.planType === PlanType.TeamsStarter2023 ||
      this.sub.planType === PlanType.TeamsStarter
    ) {
      if (this.isSponsoredSubscription) {
        return this.i18nService.t("subscriptionSponsoredFamiliesPlan", this.sub.seats.toString());
      } else {
        return this.i18nService.t("subscriptionUpgrade", this.sub.seats.toString());
      }
    } else if (this.sub.maxAutoscaleSeats === this.sub.seats && this.sub.seats != null) {
      const seatAdjustmentMessage = this.sub.plan.isAnnual
        ? "annualSubscriptionUserSeatsMessage"
        : "monthlySubscriptionUserSeatsMessage";
      return this.i18nService.t(
        seatAdjustmentMessage + "subscriptionSeatMaxReached",
        this.sub.seats.toString(),
      );
    } else if (this.userOrg.productTierType === ProductTierType.TeamsStarter) {
      return this.i18nService.t("subscriptionUserSeatsWithoutAdditionalSeatsOption", 10);
    } else if (this.sub.maxAutoscaleSeats == null) {
      const seatAdjustmentMessage = this.sub.plan.isAnnual
        ? "annualSubscriptionUserSeatsMessage"
        : "monthlySubscriptionUserSeatsMessage";
      return this.i18nService.t(seatAdjustmentMessage);
    } else {
      const seatAdjustmentMessage = this.sub.plan.isAnnual
        ? "annualSubscriptionUserSeatsMessage"
        : "monthlySubscriptionUserSeatsMessage";
      return this.i18nService.t(seatAdjustmentMessage, this.sub.maxAutoscaleSeats.toString());
    }
  }

  get subscriptionMarkedForCancel() {
    if (!this.subscription || this.subscription.cancelled) {
      return false;
    }

    const { status, cancelAtEndDate, cancelledDate } = this.subscription;
    return cancelAtEndDate || (status === "active" && !!cancelledDate);
  }

  cancelSubscription = async () => {
    const offer = await this.organizationBillingClient.getChurnOffer(this.organizationId as any);

    if (offer != null) {
      const churnDialogRef = ChurnMitigationOfferDialogComponent.open(this.dialogService, {
        data: {
          organizationId: this.organizationId as any,
          offer,
          accessEndDate: this.subscription?.periodEndDate ?? null,
          planName: this.sub.plan.name,
          nextChargeDate: this.subscription?.periodEndDate ?? null,
          isAnnual: this.sub.plan.isAnnual,
        },
      });

      const churnResult = await lastValueFrom(churnDialogRef.closed);

      if (churnResult === ChurnMitigationOfferDialogResultType.Accepted) {
        await this.load();
        return;
      }

      if (churnResult !== ChurnMitigationOfferDialogResultType.Declined) {
        return;
      }
      // Declined — fall through to offboarding survey
    }

    const reference = openOffboardingSurvey(this.dialogService, {
      data: {
        type: "Organization",
        id: this.organizationId,
        plan: this.sub.plan.type,
        productTier: this.sub.plan.productTier,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === OffboardingSurveyDialogResultType.Closed) {
      return;
    }

    await this.load();
  };

  reinstate = async () => {
    if (this.loading) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "reinstateSubscription" },
      content: { key: "reinstateConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.organizationApiService.reinstate(this.organizationId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("reinstated"),
      });
      await this.load();
    } catch (e) {
      this.logService.error(e);
    }
  };

  async changePlan() {
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        subscription: this.sub,
        productTierType: this.userOrg.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === ChangePlanDialogResultType.Closed) {
      return;
    }
    await this.load();
  }

  isSecretsManagerTrial(): boolean {
    const isSmStandalone = this.sub?.customerDiscount?.id === "sm-standalone";
    const appliesToProduct =
      this.sub?.subscription?.items?.some((item) =>
        this.discountAppliesToProduct(item.productId),
      ) ?? false;

    return isSmStandalone && appliesToProduct;
  }

  discountAppliesToProduct(productId: string): boolean {
    const appliesTo = this.sub?.customerDiscount?.appliesTo;
    // An empty `appliesTo` means the discount applies to the whole subscription (all products) —
    // the configuration used by churn coupons. Treat it as "applies to all", consistent with
    // `discountPrice` and with how Stripe applies an unrestricted coupon.
    return !appliesTo?.length || appliesTo.includes(productId);
  }

  closeChangePlan() {
    this.showChangePlan = false;
  }

  async downloadLicense() {
    DownloadLicenceDialogComponent.open(this.dialogService, {
      data: {
        organizationId: this.organizationId,
      },
    });
  }

  async manageBillingSync() {
    const dialogRef = BillingSyncApiKeyComponent.open(this.dialogService, {
      organizationId: this.organizationId,
      hasBillingToken: this.hasBillingSyncToken,
    });

    await firstValueFrom(dialogRef.closed);
    await this.load();
  }

  async subscriptionAdjusted() {
    await this.load();
  }

  adjustStorage = (add: boolean) => {
    return async () => {
      const dialogRef = AdjustStorageDialogComponent.open(this.dialogService, {
        data: {
          price: this.storageGbPrice,
          cadence: this.billingInterval,
          type: add ? "Add" : "Remove",
          organizationId: this.organizationId,
        },
      });

      const result = await lastValueFrom(dialogRef.closed);

      if (result === AdjustStorageDialogResultType.Submitted) {
        await this.load();
      }
    };
  };

  removeSponsorship = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeSponsorship" },
      content: { key: "removeSponsorshipConfirmation" },
      acceptButtonText: { key: "remove" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.apiService.deleteRemoveSponsorship(this.organizationId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("removeSponsorshipSuccess"),
      });
      await this.load();
    } catch (e) {
      this.logService.error(e);
    }
  };

  // Per-unit discounted price. ONLY the percentage discount reduces the per-unit price (a percentage
  // scales linearly, so per-unit × quantity equals the discounted line total). A fixed `amountOff`
  // applies once to the line/subscription total, NOT per seat — it is applied in `subscriptionLineItems`
  // (see `discountedLineTotals`), so the per-unit price returned here stays at full value for amount-off.
  // Gates on discount PRESENCE + product-applicability, NOT the perpetual `active` flag, so
  // time-bounded (repeating) discounts also reduce the displayed price. `active` is intentionally
  // not consulted here anymore (it still means "perpetual" for other consumers, e.g. sm-subscribe).
  discountPrice = (price: number, productId: string = null) => {
    const customerDiscount = this.customerDiscount;

    const applies =
      customerDiscount?.percentOff != null &&
      (!productId ||
        !customerDiscount.appliesTo.length ||
        customerDiscount.appliesTo.includes(productId));

    if (!applies) {
      return price;
    }

    return (
      price -
      getAmount({ type: DiscountTypes.PercentOff, value: customerDiscount.percentOff }, price)
    );
  };

  // View-only label for the time bound on a repeating discount. Copy lives in i18n keys (pending
  // design sign-off); public to match the sibling template-called methods (discountPrice /
  // discountAppliesToProduct). The `end`-date branch is rendered directly in the template via the
  // `date` pipe, so this helper only covers the `durationInMonths` path.
  discountDurationLabel(): string | null {
    const months = this.customerDiscount?.durationInMonths;
    if (months == null) {
      return null;
    }
    return months === 12
      ? this.i18nService.t("discountForOneYear")
      : this.i18nService.t("discountForMonths", months.toString());
  }

  get showChangePlanButton() {
    return (
      (!this.showChangePlan &&
        this.sub.plan.productTier !== ProductTierType.Enterprise &&
        !this.sub.subscription?.cancelled) ||
      (this.sub.subscription?.cancelled && this.sub.plan.productTier === ProductTierType.Free)
    );
  }

  get canUseBillingSync() {
    return this.userOrg.productTierType === ProductTierType.Enterprise;
  }
}

/**
 * Helper to sort subscription items by productTier type and then by addon status
 */
function sortSubscriptionItems(
  a: BillingSubscriptionItemResponse,
  b: BillingSubscriptionItemResponse,
) {
  if (a.productName == b.productName) {
    if (a.addonSubscriptionItem == b.addonSubscriptionItem) {
      return 0;
    }
    // sort addon items to the bottom
    if (a.addonSubscriptionItem) {
      return 1;
    }
    return -1;
  }
  return a.productName.localeCompare(b.productName);
}
