import { ChangeDetectionStrategy, Component, computed, inject, resource } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { filter, firstValueFrom, lastValueFrom, map, switchMap, take } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  ContainerComponent,
  DialogService,
  FormControlModule,
  ProgressBarComponent,
  SpinnerComponent,
  ToastService,
  TypographyModule,
  IconComponent,
} from "@bitwarden/components";
import { DiscountTypes, getAmount } from "@bitwarden/pricing";
import {
  SubscriptionCardAction,
  SubscriptionCardActions,
  SubscriptionCardComponent,
} from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";
import { OrganizationBillingClient } from "../clients";
import {
  AdjustStorageDialogComponent,
  AdjustStorageDialogResultType,
} from "../shared/adjust-storage-dialog/adjust-storage-dialog.component";
import {
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "../shared/offboarding-survey.component";

import { AdjustSubscription } from "./adjust-subscription.component";
import { BillingSyncApiKeyComponent } from "./billing-sync-api-key.component";
import { ChangePlanDialogResultType, openChangePlanDialog } from "./change-plan-dialog.component";
import {
  ChurnMitigationOfferDialogComponent,
  ChurnMitigationOfferDialogResultType,
} from "./churn-mitigation-offer-dialog.component";
import { DownloadLicenceDialogComponent } from "./download-license.component";
import { OrganizationSubscriptionDataService } from "./organization-subscription-data.service";
import { resolveOrgSubscriptionAccess } from "./resolve-org-subscription-access";
import {
  SecretsManagerAdjustSubscriptionComponent,
  SecretsManagerSubscriptionOptions,
} from "./sm-adjust-subscription.component";
import { SecretsManagerSubscribeStandaloneComponent } from "./sm-subscribe-standalone.component";
import { OrganizationScheduledPriceIncreaseWarningComponent } from "./warnings/components";

const FAMILIES_OR_STARTER_PLANS: PlanType[] = [
  PlanType.FamiliesAnnually,
  PlanType.FamiliesAnnually2025,
  PlanType.FamiliesAnnually2019,
  PlanType.TeamsStarter2023,
  PlanType.TeamsStarter,
];

const QUERY_PARAM_UPGRADE = "upgrade";
const QUERY_PARAM_PRODUCT_TIER = "productTierType";

@Component({
  selector: "app-organization-subscription-cloud-vnext",
  templateUrl: "./organization-subscription-cloud-vnext.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    ContainerComponent,
    FormControlModule,
    ProgressBarComponent,
    SpinnerComponent,
    TypographyModule,
    I18nPipe,
    HeaderModule,
    SubscriptionCardComponent,
    OrganizationScheduledPriceIncreaseWarningComponent,
    AdjustSubscription,
    SecretsManagerSubscribeStandaloneComponent,
    SecretsManagerAdjustSubscriptionComponent,
    IconComponent,
  ],
})
export class OrganizationSubscriptionCloudVNextComponent {
  private readonly data = inject(OrganizationSubscriptionDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly apiService = inject(ApiService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly organizationBillingClient = inject(OrganizationBillingClient);

  readonly organizationId: string = this.route.snapshot.params.organizationId;

  readonly organization = toSignal(this.data.organization$(this.organizationId));
  readonly organizationSubscription = toSignal(
    this.data.organizationSubscription$(this.organizationId),
  );
  readonly hasBillingSyncToken = toSignal(this.data.hasBillingSyncToken$(this.organizationId));
  readonly resellerSeatsRemaining = toSignal(
    this.data.resellerSeatsRemaining$(this.organizationId),
  );

  /**
   * Returns a subscription preview for the given organization.
   * @returns A resource that resolves to the subscription preview for the given organization.
   * @summary Provides a reactive resource for the subscription preview of the organization.
   */
  readonly subscriptionPreview = resource({
    params: () => ({ org: this.organization() }),
    loader: async ({ params: { org } }) => {
      return org ? await this.data.getSubscriptionPreview(org.id) : null;
    },
  });

  constructor() {
    this.openChangePlanIfUpgradeRequested();
  }

  private readonly billingSubscription = computed(
    () => this.organizationSubscription()?.subscription ?? null,
  );
  protected readonly customerDiscount = computed(
    () => this.organizationSubscription()?.customerDiscount ?? null,
  );

  readonly access = computed(() => {
    const org = this.organization();
    return org ? resolveOrgSubscriptionAccess(org) : null;
  });

  readonly showSubscription = computed(() => this.access()?.showSubscription ?? false);
  readonly showManagementActions = computed(() => this.access()?.showManagementActions ?? false);
  readonly showSelfHost = computed(() => this.access()?.showSelfHost ?? false);
  readonly showConsolidatedBillingMsp = computed(
    () => this.access()?.showConsolidatedBillingMsp ?? false,
  );

  readonly cardTitle = computed(() => {
    const plan = this.organizationSubscription()?.plan;
    if (plan == null) {
      return null;
    }
    const cadence = this.i18nService.t(plan.isAnnual ? "annual" : "monthly");
    return `${this.i18nService.t(plan.nameLocalizationKey)} ${cadence}`;
  });

  readonly subscriptionMarkedForCancel = computed(() => {
    const sub = this.billingSubscription();
    if (sub == null || sub.cancelled) {
      return false;
    }
    return sub.cancelAtEndDate || (sub.status === "active" && sub.cancelledDate != null);
  });

  readonly isSponsoredSubscription = computed(
    () => this.billingSubscription()?.items.some((item) => item.sponsoredSubscriptionItem) ?? false,
  );

  // Reseller organizations exempt from billing automation are billed externally, so the card's
  // status callout (past due, unpaid, etc.) must be suppressed for them, mirroring the legacy page.
  readonly hideSubscriptionCallout = computed(
    () =>
      (this.organization()?.hasReseller &&
        this.organizationSubscription()?.exemptFromBillingAutomation) ??
      false,
  );

  readonly canAdjustSeats = computed(
    () => this.organizationSubscription()?.plan.PasswordManager.hasAdditionalSeatsOption ?? false,
  );

  readonly canUseBillingSync = computed(
    () => this.organization()?.productTierType === ProductTierType.Enterprise,
  );

  readonly showChangePlanButton = computed(() => {
    const sub = this.organizationSubscription();
    if (sub == null) {
      return false;
    }
    const cancelled = sub.subscription?.cancelled ?? false;
    if (sub.plan.productTier !== ProductTierType.Enterprise && !cancelled) {
      return true;
    }
    return cancelled && sub.plan.productTier === ProductTierType.Free;
  });

  readonly showSecretsManagerSubscribe = computed(() => {
    const org = this.organization();
    const sub = this.organizationSubscription();
    if (org == null || sub == null) {
      return false;
    }
    return (
      org.canEditSubscription &&
      !org.hasProvider &&
      sub.plan.SecretsManager != null &&
      !org.useSecretsManager &&
      !this.billingSubscription()?.cancelled &&
      !this.subscriptionMarkedForCancel()
    );
  });

  readonly showAdjustSecretsManager = computed(() => {
    const org = this.organization();
    const sub = this.organizationSubscription();
    const billing = this.billingSubscription();
    if (org == null || sub == null || billing == null) {
      return false;
    }
    return (
      org.canEditSubscription &&
      org.useSecretsManager &&
      sub.plan.SecretsManager?.hasAdditionalSeatsOption === true &&
      !billing.cancelled &&
      !this.subscriptionMarkedForCancel()
    );
  });

  readonly canAdjustSubscription = computed(() => {
    const org = this.organization();
    const billing = this.billingSubscription();
    if (org == null || billing == null) {
      return false;
    }
    const discount = this.customerDiscount();
    return (
      org.canEditSubscription &&
      this.canAdjustSeats() &&
      !billing.cancelled &&
      !this.subscriptionMarkedForCancel() &&
      (discount == null || discount.id !== "sm-standalone")
    );
  });

  readonly canAdjustStorage = computed(() => {
    const org = this.organization();
    if (org == null) {
      return false;
    }
    const discount = this.customerDiscount();
    return org.canEditSubscription && (discount == null || discount.id !== "sm-standalone");
  });

  readonly canModifySubscription = computed(() => {
    const billing = this.billingSubscription();
    return billing != null && !billing.cancelled && !this.subscriptionMarkedForCancel();
  });

  readonly billingInterval = computed(() =>
    this.organizationSubscription()?.plan.isAnnual ? "year" : "month",
  );

  readonly storageGbPrice = computed(
    () => this.organizationSubscription()?.plan.PasswordManager.additionalStoragePricePerGb ?? 0,
  );

  readonly seatPrice = computed(() => {
    const price = this.organizationSubscription()?.plan.PasswordManager.seatPrice;
    return price == null ? 0 : this.discountPrice(price);
  });

  readonly seats = computed(() => this.organizationSubscription()?.seats);

  readonly maxAutoscaleSeats = computed(() => this.organizationSubscription()?.maxAutoscaleSeats);

  readonly maxStorageGb = computed(() => this.organizationSubscription()?.maxStorageGb ?? 0);

  readonly storageName = computed(() => this.organizationSubscription()?.storageName ?? "0 MB");

  readonly storagePercentage = computed(() => {
    const sub = this.organizationSubscription();
    return sub?.maxStorageGb ? +(100 * (sub.storageGb / sub.maxStorageGb)).toFixed(2) : 0;
  });

  readonly smOptions = computed<SecretsManagerSubscriptionOptions | null>(() => {
    const sub = this.organizationSubscription();
    if (sub == null) {
      return null;
    }
    return {
      seatCount: sub.smSeats ?? 0,
      maxAutoscaleSeats: sub.maxAutoscaleSmSeats ?? 0,
      seatPrice: sub.plan.SecretsManager.seatPrice,
      maxAutoscaleServiceAccounts: sub.maxAutoscaleSmServiceAccounts ?? 0,
      additionalServiceAccounts: Math.max(
        0,
        (sub.smServiceAccounts ?? 0) -
          sub.plan.SecretsManager.baseServiceAccount -
          (sub.smServiceAccountsGrace ?? 0),
      ),
      interval: sub.plan.isAnnual ? "year" : "month",
      additionalServiceAccountPrice: sub.plan.SecretsManager.additionalPricePerServiceAccount,
      baseServiceAccountCount: sub.plan.SecretsManager.baseServiceAccount,
      graceServiceAccounts: sub.smServiceAccountsGrace ?? 0,
    };
  });

  readonly subscriptionDesc = computed(() => {
    const sub = this.organizationSubscription();
    const org = this.organization();
    if (sub == null) {
      return "";
    }
    if (sub.planType === PlanType.Free) {
      return this.i18nService.t("subscriptionFreePlan", sub.seats.toString());
    }
    if (FAMILIES_OR_STARTER_PLANS.includes(sub.planType)) {
      return this.isSponsoredSubscription()
        ? this.i18nService.t("subscriptionSponsoredFamiliesPlan", sub.seats.toString())
        : this.i18nService.t("subscriptionUpgrade", sub.seats.toString());
    }
    if (sub.maxAutoscaleSeats === sub.seats && sub.seats != null) {
      const key = sub.plan.isAnnual
        ? "annualSubscriptionUserSeatsMessage"
        : "monthlySubscriptionUserSeatsMessage";
      return this.i18nService.t(key + "subscriptionSeatMaxReached", sub.seats.toString());
    }
    if (org?.productTierType === ProductTierType.TeamsStarter) {
      return this.i18nService.t("subscriptionUserSeatsWithoutAdditionalSeatsOption", 10);
    }
    const key = sub.plan.isAnnual
      ? "annualSubscriptionUserSeatsMessage"
      : "monthlySubscriptionUserSeatsMessage";
    if (sub.maxAutoscaleSeats == null) {
      return this.i18nService.t(key);
    }
    return this.i18nService.t(key, sub.maxAutoscaleSeats.toString());
  });

  handleCardAction(action: SubscriptionCardAction) {
    switch (action) {
      case SubscriptionCardActions.ReinstateSubscription:
        void this.reinstate();
        return;
      case SubscriptionCardActions.UpgradePlan:
      case SubscriptionCardActions.Resubscribe:
        void this.changePlan();
        return;
      case SubscriptionCardActions.ManageInvoices:
        void this.router.navigate(["../history"], { relativeTo: this.route });
        return;
      case SubscriptionCardActions.UpdatePayment:
        void this.router.navigate(["../payment-details"], { relativeTo: this.route });
        return;
      case SubscriptionCardActions.ContactSupport:
        this.platformUtilsService.launchUri("https://bitwarden.com/contact/");
        return;
    }
  }

  readonly changePlan = async (preSelectedProductTier?: ProductTierType) => {
    const sub = this.organizationSubscription();
    const org = this.organization();
    if (sub == null || org == null) {
      return;
    }
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        subscription: sub,
        productTierType: preSelectedProductTier ?? org.productTierType,
      },
    });
    const result = await lastValueFrom(reference.closed);
    if (result === ChangePlanDialogResultType.Closed) {
      return;
    }
    this.reloadSubscriptionPreview();
  };

  readonly reinstate = async () => {
    if (this.subscriptionPreview.isLoading()) {
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
        title: undefined,
        message: this.i18nService.t("reinstated"),
      });
      this.reloadSubscriptionPreview();
    } catch (e) {
      this.logService.error(e);
    }
  };

  readonly cancelSubscription = async () => {
    const sub = this.organizationSubscription();
    if (sub == null) {
      return;
    }
    const billing = this.billingSubscription();
    const offer = await this.organizationBillingClient.getChurnOffer(
      this.organizationId as OrganizationId,
    );

    if (offer != null) {
      const churnDialogRef = ChurnMitigationOfferDialogComponent.open(this.dialogService, {
        data: {
          organizationId: this.organizationId as OrganizationId,
          offer,
          accessEndDate: billing?.periodEndDate ?? null,
          planName: sub.plan.name,
          nextChargeDate: billing?.periodEndDate ?? null,
          isAnnual: sub.plan.isAnnual,
        },
      });

      const churnResult = await lastValueFrom(churnDialogRef.closed);

      if (churnResult === ChurnMitigationOfferDialogResultType.Accepted) {
        this.reloadSubscriptionPreview();
        return;
      }

      if (churnResult !== ChurnMitigationOfferDialogResultType.Declined) {
        return;
      }
    }

    const reference = openOffboardingSurvey(this.dialogService, {
      data: {
        type: "Organization",
        id: this.organizationId,
        plan: sub.plan.type,
        productTier: sub.plan.productTier,
      },
    });

    const result = await lastValueFrom(reference.closed);
    if (result === OffboardingSurveyDialogResultType.Closed) {
      return;
    }
    this.reloadSubscriptionPreview();
  };

  readonly adjustStorage = (add: boolean) => {
    return async () => {
      const dialogRef = AdjustStorageDialogComponent.open(this.dialogService, {
        data: {
          price: this.storageGbPrice(),
          cadence: this.billingInterval(),
          type: add ? "Add" : "Remove",
          organizationId: this.organizationId,
        },
      });

      const result = await lastValueFrom(dialogRef.closed);
      if (result === AdjustStorageDialogResultType.Submitted) {
        this.reloadSubscriptionPreview();
      }
    };
  };

  readonly removeSponsorship = async () => {
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
        title: undefined,
        message: this.i18nService.t("removeSponsorshipSuccess"),
      });
      this.reloadSubscriptionPreview();
    } catch (e) {
      this.logService.error(e);
    }
  };

  async downloadLicense() {
    DownloadLicenceDialogComponent.open(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
  }

  async manageBillingSync() {
    const dialogRef = BillingSyncApiKeyComponent.open(this.dialogService, {
      organizationId: this.organizationId,
      hasBillingToken: this.hasBillingSyncToken() ?? false,
    });
    await firstValueFrom(dialogRef.closed);
    this.reloadSubscriptionPreview();
  }

  subscriptionAdjusted() {
    this.reloadSubscriptionPreview();
  }

  /** Opens the change plan dialog if the upgrade query parameter is present. */
  private openChangePlanIfUpgradeRequested() {
    const subscription$ = toObservable(this.organizationSubscription);
    this.route.queryParamMap
      .pipe(
        filter((params) => params.get(QUERY_PARAM_UPGRADE) != null),
        switchMap((params) =>
          subscription$.pipe(
            filter((subscription) => subscription != null),
            take(1),
            map(() => this.toProductTier(params.get(QUERY_PARAM_PRODUCT_TIER))),
          ),
        ),
        take(1),
        takeUntilDestroyed(),
      )
      .subscribe((preSelectedProductTier) => void this.changePlan(preSelectedProductTier));
  }

  private toProductTier(value: string | null): ProductTierType | undefined {
    if (value == null) {
      return undefined;
    }
    const productTier = Number(value);
    return Object.values(ProductTierType).includes(productTier as ProductTierType)
      ? (productTier as ProductTierType)
      : undefined;
  }

  private discountPrice(price: number): number {
    const discount = this.customerDiscount();
    if (discount?.percentOff == null) {
      return price;
    }
    return price - getAmount({ type: DiscountTypes.PercentOff, value: discount.percentOff }, price);
  }

  protected reloadSubscriptionPreview() {
    this.subscriptionPreview.reload();
  }
}
