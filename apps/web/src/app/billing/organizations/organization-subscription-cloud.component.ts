import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, firstValueFrom, lastValueFrom, Observable, Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { OrganizationApiKeyType, ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { BillingSubscriptionItemResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  AdjustStorageDialogV2Component,
  AdjustStorageDialogV2ResultType,
} from "../shared/adjust-storage-dialog/adjust-storage-dialog-v2.component";
import {
  AdjustStorageDialogResult,
  openAdjustStorageDialog,
} from "../shared/adjust-storage-dialog/adjust-storage-dialog.component";
import {
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "../shared/offboarding-survey.component";

import { BillingSyncApiKeyComponent } from "./billing-sync-api-key.component";
import { ChangePlanDialogResultType, openChangePlanDialog } from "./change-plan-dialog.component";
import { DownloadLicenceDialogComponent } from "./download-license.component";
import { ManageBilling } from "./icons/manage-billing.icon";
import { SecretsManagerSubscriptionOptions } from "./sm-adjust-subscription.component";

@Component({
  templateUrl: "organization-subscription-cloud.component.html",
})
export class OrganizationSubscriptionCloudComponent implements OnInit, OnDestroy {
  sub: OrganizationSubscriptionResponse;
  lineItems: BillingSubscriptionItemResponse[] = [];
  organizationId: string;
  userOrg: Organization;
  showChangePlan = false;
  showDownloadLicense = false;
  hasBillingSyncToken: boolean;
  showAdjustSecretsManager = false;
  showSecretsManagerSubscribe = false;
  firstLoaded = false;
  loading: boolean;
  locale: string;
  showUpdatedSubscriptionStatusSection$: Observable<boolean>;
  manageBillingFromProviderPortal = ManageBilling;
  isManagedByConsolidatedBillingMSP = false;
  preSelectedProductTier: ProductTierType = ProductTierType.Free;

  protected readonly teamsStarter = ProductTierType.TeamsStarter;

  private destroy$ = new Subject<void>();

  protected enableConsolidatedBilling$ = this.configService.getFeatureFlag$(
    FeatureFlag.EnableConsolidatedBilling,
  );

  protected EnableUpgradePasswordManagerSub$ = this.configService.getFeatureFlag$(
    FeatureFlag.EnableUpgradePasswordManagerSub,
  );

  protected deprecateStripeSourcesAPI$ = this.configService.getFeatureFlag$(
    FeatureFlag.AC2476_DeprecateStripeSourcesAPI,
  );

  constructor(
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private configService: ConfigService,
    private providerService: ProviderService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    if (this.route.snapshot.queryParamMap.get("upgrade")) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.changePlan();
      const productTierTypeStr = this.route.snapshot.queryParamMap.get("productTierType");
      if (productTierTypeStr != null) {
        const productTier = Number(productTierTypeStr);
        if (Object.values(ProductTierType).includes(productTier as ProductTierType)) {
          this.preSelectedProductTier = productTier;
        }
      }
    }

    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.organizationId = params.organizationId;
          await this.load();
          this.firstLoaded = true;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.showUpdatedSubscriptionStatusSection$ = this.configService.getFeatureFlag$(
      FeatureFlag.AC1795_UpdatedSubscriptionStatusSection,
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.locale = await firstValueFrom(this.i18nService.locale$);
    this.userOrg = await this.organizationService.get(this.organizationId);

    if (this.userOrg.canViewSubscription) {
      const enableConsolidatedBilling = await firstValueFrom(this.enableConsolidatedBilling$);
      const provider = await this.providerService.get(this.userOrg.providerId);
      this.isManagedByConsolidatedBillingMSP =
        enableConsolidatedBilling &&
        this.userOrg.hasProvider &&
        provider?.providerStatus == ProviderStatusType.Billable;

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

    this.loading = false;
  }

  get subscription() {
    return this.sub != null ? this.sub.subscription : null;
  }

  get subscriptionLineItems() {
    return this.lineItems.map((lineItem: BillingSubscriptionItemResponse) => ({
      name: lineItem.name,
      amount: this.discountPrice(lineItem.amount, lineItem.productId),
      quantity: lineItem.quantity,
      interval: lineItem.interval,
      sponsoredSubscriptionItem: lineItem.sponsoredSubscriptionItem,
      addonSubscriptionItem: lineItem.addonSubscriptionItem,
      productName: lineItem.productName,
      productId: lineItem.productId,
    }));
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
      additionalServiceAccounts:
        this.sub.smServiceAccounts - this.sub.plan.SecretsManager.baseServiceAccount,
      interval: this.sub.plan.isAnnual ? "year" : "month",
      additionalServiceAccountPrice: this.sub.plan.SecretsManager.additionalPricePerServiceAccount,
      baseServiceAccountCount: this.sub.plan.SecretsManager.baseServiceAccount,
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

  get canDownloadLicense() {
    return (
      (this.sub.planType !== PlanType.Free && this.subscription == null) ||
      (this.subscription != null && !this.subscription.cancelled)
    );
  }

  get canManageBillingSync() {
    return (
      this.sub.planType === PlanType.EnterpriseAnnually ||
      this.sub.planType === PlanType.EnterpriseMonthly ||
      this.sub.planType === PlanType.EnterpriseAnnually2023 ||
      this.sub.planType === PlanType.EnterpriseMonthly2023 ||
      this.sub.planType === PlanType.EnterpriseAnnually2020 ||
      this.sub.planType === PlanType.EnterpriseMonthly2020 ||
      this.sub.planType === PlanType.EnterpriseAnnually2019 ||
      this.sub.planType === PlanType.EnterpriseMonthly2019
    );
  }

  get subscriptionDesc() {
    if (this.sub.planType === PlanType.Free) {
      return this.i18nService.t("subscriptionFreePlan", this.sub.seats.toString());
    } else if (
      this.sub.planType === PlanType.FamiliesAnnually ||
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
    return (
      this.subscription != null && !this.subscription.cancelled && this.subscription.cancelAtEndDate
    );
  }

  shownSelfHost(): boolean {
    return (
      this.sub?.plan.productTier !== ProductTierType.Teams &&
      this.sub?.plan.productTier !== ProductTierType.Free
    );
  }

  cancelSubscription = async () => {
    const reference = openOffboardingSurvey(this.dialogService, {
      data: {
        type: "Organization",
        id: this.organizationId,
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.load();
    } catch (e) {
      this.logService.error(e);
    }
  };

  async changePlan() {
    const EnableUpgradePasswordManagerSub = await firstValueFrom(
      this.EnableUpgradePasswordManagerSub$,
    );
    if (EnableUpgradePasswordManagerSub) {
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
    } else {
      this.showChangePlan = !this.showChangePlan;
    }
  }

  isSecretsManagerTrial(): boolean {
    return (
      this.sub?.subscription?.items?.some((item) =>
        this.sub?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
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
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.load();
  }

  closeDownloadLicense() {
    this.showDownloadLicense = false;
  }

  subscriptionAdjusted() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.load();
  }

  calculateTotalAppliedDiscount(total: number) {
    const discountedTotal = total / (1 - this.customerDiscount?.percentOff / 100);
    return discountedTotal;
  }

  adjustStorage = (add: boolean) => {
    return async () => {
      const deprecateStripeSourcesAPI = await firstValueFrom(this.deprecateStripeSourcesAPI$);

      if (deprecateStripeSourcesAPI) {
        const dialogRef = AdjustStorageDialogV2Component.open(this.dialogService, {
          data: {
            price: this.storageGbPrice,
            cadence: this.billingInterval,
            type: add ? "Add" : "Remove",
            organizationId: this.organizationId,
          },
        });

        const result = await lastValueFrom(dialogRef.closed);

        if (result === AdjustStorageDialogV2ResultType.Submitted) {
          await this.load();
        }
      } else {
        const dialogRef = openAdjustStorageDialog(this.dialogService, {
          data: {
            storageGbPrice: this.storageGbPrice,
            add: add,
            organizationId: this.organizationId,
            interval: this.billingInterval,
          },
        });
        const result = await lastValueFrom(dialogRef.closed);
        if (result === AdjustStorageDialogResult.Adjusted) {
          await this.load();
        }
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

  discountPrice = (price: number, productId: string = null) => {
    const discount =
      this.customerDiscount?.active &&
      (!productId ||
        !this.customerDiscount.appliesTo.length ||
        this.customerDiscount.appliesTo.includes(productId))
        ? price * (this.customerDiscount.percentOff / 100)
        : 0;

    return price - discount;
  };

  get showChangePlanButton() {
    return this.sub.plan.productTier !== ProductTierType.Enterprise && !this.showChangePlan;
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
