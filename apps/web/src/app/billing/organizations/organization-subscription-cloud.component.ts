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
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { BillingSubscriptionItemResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

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
    private configService: ConfigService,
    private toastService: ToastService,
    private billingApiService: BillingApiServiceAbstraction,
    private organizationUserApiService: OrganizationUserApiService,
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
    return (
      this.subscription != null && !this.subscription.cancelled && this.subscription.cancelAtEndDate
    );
  }

  cancelSubscription = async () => {
    const reference = openOffboardingSurvey(this.dialogService, {
      data: {
        type: "Organization",
        id: this.organizationId,
        plan: this.sub.plan.type,
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
    await this.load();
  }

  async subscriptionAdjusted() {
    await this.load();
  }

  calculateTotalAppliedDiscount(total: number) {
    return total / (1 - this.customerDiscount?.percentOff / 100);
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
