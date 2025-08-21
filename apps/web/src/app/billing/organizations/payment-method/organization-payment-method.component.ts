import { Location } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom, from, lastValueFrom, map, switchMap } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { VerifyBankAccountRequest } from "@bitwarden/common/billing/models/request/verify-bank-account.request";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PaymentSourceResponse } from "@bitwarden/common/billing/models/response/payment-source.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService, ToastService } from "@bitwarden/components";

import { BillingNotificationService } from "../../services/billing-notification.service";
import { TrialFlowService } from "../../services/trial-flow.service";
import {
  AddCreditDialogResult,
  openAddCreditDialog,
} from "../../shared/add-credit-dialog.component";
import {
  AdjustPaymentDialogComponent,
  AdjustPaymentDialogResultType,
} from "../../shared/adjust-payment-dialog/adjust-payment-dialog.component";
import {
  TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE,
  TrialPaymentDialogComponent,
} from "../../shared/trial-payment-dialog/trial-payment-dialog.component";
import { FreeTrial } from "../../types/free-trial";

@Component({
  templateUrl: "./organization-payment-method.component.html",
  standalone: false,
})
export class OrganizationPaymentMethodComponent implements OnDestroy {
  organizationId!: string;
  isUnpaid = false;
  accountCredit?: number;
  paymentSource?: PaymentSourceResponse;
  subscriptionStatus?: string;
  protected freeTrialData?: FreeTrial;
  organization?: Organization;
  organizationSubscriptionResponse?: OrganizationSubscriptionResponse;

  loading = true;

  protected readonly Math = Math;
  launchPaymentModalAutomatically = false;

  protected taxInformation?: TaxInformation;

  constructor(
    private activatedRoute: ActivatedRoute,
    private billingApiService: BillingApiServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private toastService: ToastService,
    private location: Location,
    private trialFlowService: TrialFlowService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    protected syncService: SyncService,
    private billingNotificationService: BillingNotificationService,
    private configService: ConfigService,
  ) {
    combineLatest([
      this.activatedRoute.params,
      this.configService.getFeatureFlag$(FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout),
    ])
      .pipe(
        switchMap(([{ organizationId }, managePaymentDetailsOutsideCheckout]) => {
          if (this.platformUtilsService.isSelfHost()) {
            return from(this.router.navigate(["/settings/subscription"]));
          }

          if (managePaymentDetailsOutsideCheckout) {
            return from(
              this.router.navigate(["../payment-details"], { relativeTo: this.activatedRoute }),
            );
          }

          this.organizationId = organizationId;
          return from(this.load());
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    const state = this.router.getCurrentNavigation()?.extras?.state;
    // In case the above state is undefined or null, we use redundantState
    const redundantState: any = location.getState();
    const queryParam = this.activatedRoute.snapshot.queryParamMap.get(
      "launchPaymentModalAutomatically",
    );
    if (state && Object.prototype.hasOwnProperty.call(state, "launchPaymentModalAutomatically")) {
      this.launchPaymentModalAutomatically = state.launchPaymentModalAutomatically;
    } else if (
      redundantState &&
      Object.prototype.hasOwnProperty.call(redundantState, "launchPaymentModalAutomatically")
    ) {
      this.launchPaymentModalAutomatically = redundantState.launchPaymentModalAutomatically;
    } else if (queryParam === "true") {
      this.launchPaymentModalAutomatically = true;
    } else {
      this.launchPaymentModalAutomatically = false;
    }
  }
  ngOnDestroy(): void {
    this.launchPaymentModalAutomatically = false;
  }

  protected addAccountCredit = async (): Promise<void> => {
    if (this.subscriptionStatus === "trialing") {
      const hasValidBillingAddress = await this.checkBillingAddressForTrialingOrg();
      if (!hasValidBillingAddress) {
        return;
      }
    }
    const dialogRef = openAddCreditDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === AddCreditDialogResult.Added) {
      await this.load();
    }
  };

  protected load = async (): Promise<void> => {
    this.loading = true;
    try {
      const { accountCredit, paymentSource, subscriptionStatus, taxInformation } =
        await this.billingApiService.getOrganizationPaymentMethod(this.organizationId);
      this.accountCredit = accountCredit;
      this.paymentSource = paymentSource;
      this.subscriptionStatus = subscriptionStatus;
      this.taxInformation = taxInformation;
      this.isUnpaid = this.subscriptionStatus === "unpaid";

      if (this.organizationId) {
        const organizationSubscriptionPromise = this.organizationApiService.getSubscription(
          this.organizationId,
        );

        const userId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a?.id)),
        );

        if (!userId) {
          throw new Error("User ID is not found");
        }

        const organizationPromise = await firstValueFrom(
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(this.organizationId)),
        );

        [this.organizationSubscriptionResponse, this.organization] = await Promise.all([
          organizationSubscriptionPromise,
          organizationPromise,
        ]);

        if (!this.organization) {
          throw new Error("Organization is not found");
        }
        if (!this.paymentSource) {
          throw new Error("Payment source is not found");
        }

        this.freeTrialData = this.trialFlowService.checkForOrgsWithUpcomingPaymentIssues(
          this.organization,
          this.organizationSubscriptionResponse,
          this.paymentSource,
        );
      }
      // If the flag `launchPaymentModalAutomatically` is set to true,
      // we schedule a timeout (delay of 800ms) to automatically launch the payment modal.
      // This delay ensures that any prior UI/rendering operations complete before triggering the modal.
      if (this.launchPaymentModalAutomatically) {
        window.setTimeout(async () => {
          await this.changePayment();
          this.launchPaymentModalAutomatically = false;
          this.location.replaceState(this.location.path(), "", {});
        }, 800);
      }
    } catch (error) {
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading = false;
    }
  };

  protected updatePaymentMethod = async (): Promise<void> => {
    const dialogRef = AdjustPaymentDialogComponent.open(this.dialogService, {
      data: {
        initialPaymentMethod: this.paymentSource?.type,
        organizationId: this.organizationId,
        productTier: this.organization?.productTierType,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === AdjustPaymentDialogResultType.Submitted) {
      await this.load();
    }
  };

  changePayment = async () => {
    const dialogRef = TrialPaymentDialogComponent.open(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        subscription: this.organizationSubscriptionResponse!,
        productTierType: this.organization!.productTierType,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result === TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED) {
      this.location.replaceState(this.location.path(), "", {});
      if (this.launchPaymentModalAutomatically && !this.organization?.enabled) {
        await this.syncService.fullSync(true);
      }
      this.launchPaymentModalAutomatically = false;
      await this.load();
    }
  };

  protected verifyBankAccount = async (request: VerifyBankAccountRequest): Promise<void> => {
    await this.billingApiService.verifyOrganizationBankAccount(this.organizationId, request);
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("verifiedBankAccount"),
    });
  };

  protected get accountCreditHeaderText(): string {
    const hasAccountCredit = this.accountCredit && this.accountCredit > 0;
    const key = hasAccountCredit ? "accountCredit" : "accountBalance";
    return this.i18nService.t(key);
  }

  protected get paymentSourceClasses() {
    if (this.paymentSource == null) {
      return [];
    }
    switch (this.paymentSource.type) {
      case PaymentMethodType.Card:
        return ["bwi-credit-card"];
      case PaymentMethodType.BankAccount:
      case PaymentMethodType.Check:
        return ["bwi-billing"];
      case PaymentMethodType.PayPal:
        return ["bwi-paypal text-primary"];
      default:
        return [];
    }
  }

  protected get subscriptionIsUnpaid(): boolean {
    return this.subscriptionStatus === "unpaid";
  }

  protected get updatePaymentSourceButtonText(): string {
    const key = this.paymentSource == null ? "addPaymentMethod" : "changePaymentMethod";
    return this.i18nService.t(key);
  }

  private async checkBillingAddressForTrialingOrg(): Promise<boolean> {
    const hasBillingAddress = this.taxInformation != null;
    if (!hasBillingAddress) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("billingAddressRequiredToAddCredit"),
      });
      return false;
    }
    return true;
  }
}
