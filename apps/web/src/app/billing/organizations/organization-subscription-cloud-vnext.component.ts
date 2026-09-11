import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, resource } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  shareReplay,
  switchMap,
  take,
} from "rxjs";

import { GearIcon } from "@bitwarden/assets/svg";
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
  ContainerComponent,
  DialogService,
  FormControlModule,
  ProgressBarComponent,
  SpinnerComponent,
  TableModule,
  ToastService,
  TypographyModule,
  CalloutComponent,
  SvgComponent,
} from "@bitwarden/components";
import { DiscountTypes, getAmount } from "@bitwarden/pricing";
import {
  ErrorCardComponent,
  SubscriptionCardAction,
  SubscriptionCardActions,
  SubscriptionCardComponent,
  SubscriptionPreview,
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

/** Maps a subscription status to its i18n key for the resold-org status table. */
const SubscriptionStatusLabels: Record<string, string> = {
  trialing: "trial",
  active: "active",
  past_due: "pastDue",
  unpaid: "unpaid",
  canceled: "canceled",
};

@Component({
  selector: "app-organization-subscription-cloud-vnext",
  templateUrl: "./organization-subscription-cloud-vnext.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    AsyncActionsModule,
    ButtonModule,
    ContainerComponent,
    FormControlModule,
    ProgressBarComponent,
    SpinnerComponent,
    TableModule,
    TypographyModule,
    I18nPipe,
    HeaderModule,
    SubscriptionCardComponent,
    OrganizationScheduledPriceIncreaseWarningComponent,
    AdjustSubscription,
    SecretsManagerSubscribeStandaloneComponent,
    SecretsManagerAdjustSubscriptionComponent,
    ErrorCardComponent,
    CalloutComponent,
    DatePipe,
    SvgComponent,
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

  // Re-fires the subscription data streams after a mutation (reinstate, cancel, storage, etc.).
  // Seeded so the streams load once on init, then reload each time refreshAll() emits.
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly organizationId: string = this.route.snapshot.params.organizationId;
  readonly gearIcon = GearIcon;

  constructor() {
    this.openChangePlanIfUpgradeRequested();
  }

  readonly organization = toSignal(
    this.refresh$.pipe(switchMap(() => this.data.organization$(this.organizationId))),
  );

  /**
   * Observable for the organization subscription data.
   * @summary Provides a reactive stream for the subscription details of the organization.
   * the shareReplay operator ensures that the latest subscription data is shared among all subscribers,
   * preventing redundant network requests.
   * @returns A reactive stream that emits the subscription details of the organization.
   *
   */
  private readonly organizationSubscription$ = this.refresh$.pipe(
    switchMap(() => this.data.organizationSubscription$(this.organizationId)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly organizationSubscription = toSignal(this.organizationSubscription$);

  /**
   * Observable for the presence of a billing sync token for the organization.
   * @summary Provides a reactive stream indicating whether the organization has a billing sync token.
   * @returns A reactive stream that emits a boolean value indicating the presence of a billing sync token.
   */
  readonly hasBillingSyncToken = toSignal(
    this.refresh$.pipe(switchMap(() => this.data.hasBillingSyncToken$(this.organizationId))),
  );

  /**
   * Observable for the number of reseller seats remaining for the organization.
   * @summary Provides a reactive stream indicating the remaining reseller seats for the organization.
   * @returns A reactive stream that emits the number of reseller seats remaining.
   */
  readonly resellerSeatsRemaining = toSignal(
    this.refresh$.pipe(switchMap(() => this.data.resellerSeatsRemaining$(this.organizationId))),
  );

  /**
   * Returns a subscription preview for the given organization.
   * @returns A resource that resolves to the subscription preview for the given organization.
   * @summary Provides a reactive resource for the subscription preview of the organization.
   */
  readonly subscriptionPreview = resource({
    // Keyed on the id, not the object: organizations$ emits a new instance on every sync.
    params: () =>
      this.showSubscription() && !this.isFreeOrg() ? this.organization()?.id : undefined,
    loader: async ({ params: organizationId }) => {
      return organizationId ? await this.data.getSubscriptionPreview(organizationId) : null;
    },
  });

  private readonly billingSubscription = computed(
    () => this.organizationSubscription()?.subscription ?? null,
  );

  // TODO: This exists mostly for the sm-standalone gating logic, will be removed in refactoring
  protected readonly customerDiscount = computed(
    () => this.organizationSubscription()?.customerDiscount ?? null,
  );

  /**
   * Computes the pending annual upgrade for the organization, if any.
   * @summary if a pending annual upgrade exists, it will be returned; otherwise, null is returned.
   * @returns The pending annual upgrade object, or null if none exists.
   */
  readonly pendingAnnualUpgrade = computed(() => {
    const sub = this.organizationSubscription();
    return sub?.pendingAnnualUpgrade;
  });

  /**
   * The subscription preview handed to the card, with a pending annual upgrade overlaid.
   * The invoice preview describes the current monthly renewal; the card shows the upcoming
   * annual plan, so its cadence and charge date come from the upgrade.
   */
  readonly cardSubscription = computed(() => {
    const preview = this.subscriptionPreview.hasValue() ? this.subscriptionPreview.value() : null;
    const upgrade = this.pendingAnnualUpgrade();
    if (preview == null || upgrade == null) {
      return preview;
    }
    // Only billable previews carry a next charge to re-point at the upgrade's effective date.
    if (preview.status !== "active" && preview.status !== "trialing") {
      return preview;
    }
    return {
      ...preview,
      // The invoice preview describes the current monthly cadence; the card shows the upcoming
      // annual plan, so both the cadence and the charge date come from the upgrade.
      cart: { ...preview.cart, cadence: "annually" },
      nextCharge: upgrade.effectiveDate,
    } as SubscriptionPreview;
  });

  /**
   * Computes the access rights for the organization subscription.
   * @summary Provides a reactive computation for the access rights of the organization subscription.
   * @returns The access rights object, or null if the organization is not available.
   */
  readonly access = computed(() => {
    const org = this.organization();
    return org ? resolveOrgSubscriptionAccess(org) : null;
  });

  readonly canEditSubscription = computed(() => this.access()?.canEditSubscription ?? false);
  readonly showSubscription = computed(() => this.access()?.showSubscription ?? false);
  readonly showSubscriptionStatus = computed(() => this.access()?.showSubscriptionStatus ?? false);
  readonly isFreeOrg = computed(() => this.access()?.isFreeOrg ?? false);

  readonly cardTitle = computed(() => {
    // Determine the plan to display in the card title, prioritizing any pending annual upgrade over the current subscription plan.
    const pendingAnnualUpgrade = this.pendingAnnualUpgrade();
    const currentSubscriptionPlan = this.organizationSubscription()?.plan;
    const plan = pendingAnnualUpgrade ? pendingAnnualUpgrade.plan : currentSubscriptionPlan;
    if (plan == null) {
      return null;
    }
    const cadence = this.i18nService.t(plan.isAnnual ? "annualLower" : "monthlyLower");
    return this.i18nService.t(
      "organizationSubscriptionCardTitle",
      this.i18nService.t(plan.nameLocalizationKey),
      cadence,
    );
  });

  /**
   * Determines if the current subscription is a sponsored subscription.
   * @summary Provides a reactive computation for the sponsored subscription status.
   * @returns True if any subscription items contained in the current subscription are sponsored, false otherwise.
   */
  readonly isSponsoredSubscription = computed(
    () => this.billingSubscription()?.items.some((item) => item.sponsoredSubscriptionItem) ?? false,
  );

  /** Plan name for the resold-org status table; a pending annual upgrade takes precedence. */
  readonly statusPlanName = computed(() => {
    const orgSub = this.organizationSubscription();
    return orgSub?.pendingAnnualUpgrade?.plan?.name ?? orgSub?.plan?.name ?? null;
  });

  /** Localized status for the resold-org status table; hidden when unmapped or absent. */
  readonly statusLabel = computed(() => {
    const subscription = this.organizationSubscription()?.subscription;
    if (subscription == null) {
      return null;
    }
    // A pending cancellation is canceled-at-period-end or a cancelled-but-active subscription.
    const pendingCancellation =
      subscription.cancelAtEndDate ||
      (subscription.status === "active" && subscription.cancelledDate != null);
    const key = pendingCancellation
      ? "pendingCancellation"
      : SubscriptionStatusLabels[subscription.status];
    return key ? this.i18nService.t(key) : null;
  });

  /** Next charge date for the resold-org status table. */
  readonly nextChargeDate = computed(
    () => this.organizationSubscription()?.subscription?.periodEndDate ?? null,
  );

  readonly canAdjustSeats = computed(
    () => this.organizationSubscription()?.plan.PasswordManager.hasAdditionalSeatsOption ?? false,
  );

  /**
   * Determines if the "Change Plan" button should be shown.
   * @returns True if the change plan button should be displayed, false otherwise.
   */
  readonly showChangePlanButton = computed(() => {
    const orgSubscription = this.organizationSubscription();
    if (orgSubscription == null) {
      return false;
    }
    const isCanceled = orgSubscription?.subscription?.cancelled;
    const canChangePlan =
      orgSubscription?.plan.productTier !== ProductTierType.Enterprise && !isCanceled;

    const isFreePlanCancelled =
      isCanceled && orgSubscription?.plan.productTier === ProductTierType.Free;

    return canChangePlan || isFreePlanCancelled;
  });

  /**
   * Determines if the "Secrets Manager Subscribe" section should be shown.
   * @returns True if the section should be displayed, false otherwise.
   */
  readonly showSecretsManagerSubscribe = computed(() => {
    const org = this.organization();
    const sub = this.organizationSubscription();
    if (org == null || sub == null) {
      return false;
    }
    const hasAProvider = org.hasProvider;
    const isSubscribedToSecretsManager = org.useSecretsManager;
    const secretManagerSubscriptionInformation = sub.plan.SecretsManager;
    return (
      !hasAProvider &&
      secretManagerSubscriptionInformation != null &&
      !isSubscribedToSecretsManager &&
      !this.isSubscriptionCanceledOrPendingCancellation()
    );
  });

  /**
   * Determines if the "Adjust Secrets Manager" section should be shown.
   * @returns True if the section should be displayed, false otherwise.
   */
  readonly showAdjustSecretsManager = computed(() => {
    const org = this.organization();
    const sub = this.organizationSubscription();
    if (org == null || sub == null) {
      return false;
    }
    const isSubscribedToSecretsManager = org.useSecretsManager;
    const hasAdditionalSeatsOption = sub.plan.SecretsManager?.hasAdditionalSeatsOption;
    return (
      isSubscribedToSecretsManager &&
      hasAdditionalSeatsOption &&
      !this.isSubscriptionCanceledOrPendingCancellation()
    );
  });

  /**
   * Determines if the password manager seats can be adjusted.
   * @returns True if the password manager seats can be adjusted, false otherwise.
   */
  readonly canAdjustPasswordManagerSeats = computed(() => {
    const discount = this.customerDiscount();
    return (
      this.canAdjustSeats() &&
      !this.isSubscriptionCanceledOrPendingCancellation() &&
      // sm-standalone is the only discount we look for from legacy component
      (discount == null || discount.id !== "sm-standalone")
    );
  });

  /**
   * Determines if the "Storage" section should be shown.
   * @returns True if the section should be displayed, false otherwise.
   */
  readonly showStorage = computed(() => {
    const discount = this.customerDiscount();
    // sm-standalone is the only discount we look for from legacy component
    return discount == null || discount.id !== "sm-standalone";
  });

  /**
   * Determines if the subscription is cancelled or pending cancellation.
   * @returns True if the subscription is cancelled or pending cancellation, false otherwise.
   */
  readonly isSubscriptionCanceledOrPendingCancellation = computed(() => {
    const billing = this.billingSubscription();
    // Free organizations have no billing subscription, so nothing is cancelled.
    if (billing == null) {
      return false;
    }
    const isPendingCancellation =
      billing.cancelAtEndDate || (billing.status === "active" && billing.cancelledDate != null);
    return billing.cancelled || isPendingCancellation;
  });

  /**
   * Determines the billing interval for the subscription.
   * @returns The billing interval, either "month" or "year".
   */
  readonly billingInterval = computed(() => {
    const plan = this.organizationSubscription()?.plan;
    return plan?.isAnnual ? "year" : "month";
  });

  /**
   * Determines the price per GB of additional storage for the subscription.
   * @returns The price per GB of additional storage, or 0 if not applicable.
   */
  readonly storageGbPrice = computed(
    () => this.organizationSubscription()?.plan.PasswordManager.additionalStoragePricePerGb ?? 0,
  );

  /**
   * Determines the price per seat for the subscription.
   * @returns The price per seat, or 0 if not applicable.
   */
  readonly seatPrice = computed(() => {
    const price = this.organizationSubscription()?.plan.PasswordManager.seatPrice;
    return price == null ? 0 : this.discountPrice(price);
  });

  /**
   * Retrieves the number of seats for the subscription.
   * @returns The number of seats, or undefined if not applicable.
   */
  readonly seats = computed(() => this.organizationSubscription()?.seats);

  /**
   * Retrieves the maximum number of autoscale seats for the subscription.
   * @returns The maximum number of autoscale seats, or undefined if not applicable.
   */
  readonly maxAutoscaleSeats = computed(() => this.organizationSubscription()?.maxAutoscaleSeats);

  /**
   * Retrieves the maximum storage in GB for the subscription.
   * @returns The maximum storage in GB, or undefined if not applicable.
   */
  readonly maxStorageGb = computed(() => this.organizationSubscription()?.maxStorageGb ?? 0);

  /**
   * Retrieves the name of the storage for the subscription.
   * @returns The storage name, or "0 MB" if not applicable.
   */
  readonly storageName = computed(() => this.organizationSubscription()?.storageName ?? "0 MB");

  /**
   * Calculates the storage usage percentage for the subscription.
   * @returns The storage usage percentage, or 0 if not applicable.
   */
  readonly storagePercentage = computed(() => {
    const sub = this.organizationSubscription();
    return sub?.maxStorageGb ? +(100 * (sub.storageGb / sub.maxStorageGb)).toFixed(2) : 0;
  });

  /**
   * Retrieves the Secrets Manager subscription options for the organization.
   * @returns The Secrets Manager subscription options, or null if not applicable.
   */
  readonly smOptions = computed<SecretsManagerSubscriptionOptions | null>(() => {
    const sub = this.organizationSubscription();
    if (sub == null) {
      return null;
    }
    return {
      seatCount: sub.smSeats ?? 0,
      maxAutoscaleSeats: sub.maxAutoscaleSmSeats,
      seatPrice: sub.plan.SecretsManager.seatPrice,
      maxAutoscaleServiceAccounts: sub.maxAutoscaleSmServiceAccounts,
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

  /**
   * Retrieves the description of the subscription for display purposes.
   * @returns The subscription description, or an empty string if not applicable.
   */
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
      return this.i18nService.t("subscriptionSeatMaxReached", sub.seats.toString());
    }
    if (org?.productTierType === ProductTierType.TeamsStarter) {
      return this.i18nService.t("subscriptionUserSeatsWithoutAdditionalSeatsOption", 10);
    }
    const pendingAnnualUpgrade = this.pendingAnnualUpgrade();
    const plan = pendingAnnualUpgrade ? pendingAnnualUpgrade.plan : sub.plan;
    const key = plan.isAnnual
      ? "annualSubscriptionUserSeatsMessage"
      : "monthlySubscriptionUserSeatsMessage";
    if (sub.maxAutoscaleSeats == null) {
      return this.i18nService.t(key);
    }
    return this.i18nService.t(key, sub.maxAutoscaleSeats.toString());
  });

  /**
   * Handles actions triggered from the subscription card.
   * @param action The action to handle.
   */
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

  /**
   * Initiates the dialog to change the subscription plan for the organization.
   * @param preSelectedProductTier Optional pre-selected product tier for the change plan dialog.
   */
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
    this.refreshAll();
  };

  readonly reinstate = async () => {
    if (this.subscriptionPreview.isLoading()) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "keepSubscription" },
      content: { key: "undoCancellationRequestConfirmation" },
      type: "info",
      acceptButtonText: { key: "keepAndReactivate" },
      cancelButtonText: { key: "cancel" },
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.organizationApiService.reinstate(this.organizationId);
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("subscriptionIsNowActive"),
      });
      this.refreshAll();
    } catch (e) {
      this.logService.error(e);
    }
  };

  /**
   * Initiates the dialog to cancel the subscription for the organization.
   */
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
        this.refreshAll();
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
    this.refreshAll();
  };

  /**
   * Initiates the dialog to adjust the storage for the organization.
   * @param add Indicates whether to add or remove storage.
   */
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
        this.refreshAll();
      }
    };
  };

  /**
   * Initiates the dialog to remove the sponsorship for the organization.
   */
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
      this.refreshAll();
    } catch (e) {
      this.logService.error(e);
    }
  };

  /**
   * Initiates the dialog to download the license for the organization.
   */
  async downloadLicense() {
    DownloadLicenceDialogComponent.open(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
  }

  /**
   * Initiates the dialog to manage the billing sync for the organization.
   */
  async manageBillingSync() {
    const dialogRef = BillingSyncApiKeyComponent.open(this.dialogService, {
      organizationId: this.organizationId,
      hasBillingToken: this.hasBillingSyncToken() ?? false,
    });
    await firstValueFrom(dialogRef.closed);
    this.refreshAll();
  }

  subscriptionAdjusted() {
    this.refreshAll();
  }

  /** Opens the change plan dialog if the upgrade query parameter is present. */
  private openChangePlanIfUpgradeRequested() {
    this.route.queryParamMap
      .pipe(
        filter((params) => params.get(QUERY_PARAM_UPGRADE) != null),
        switchMap((params) =>
          this.organizationSubscription$.pipe(
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
    // Guard "" too: Number("") === 0 === ProductTierType.Free, which would pre-seed Free
    if (value == null || value === "") {
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

  protected refreshAll() {
    this.refresh$.next();
    this.subscriptionPreview.reload();
  }
}
