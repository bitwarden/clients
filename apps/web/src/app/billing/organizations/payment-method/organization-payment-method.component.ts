// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Location } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, from, lastValueFrom, map, switchMap } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { VerifyBankAccountRequest } from "@bitwarden/common/billing/models/request/verify-bank-account.request";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PaymentSourceResponse } from "@bitwarden/common/billing/models/response/payment-source.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService, ToastService } from "@bitwarden/components";

import { TrialFlowService } from "../../services/trial-flow.service";
import {
  AddCreditDialogResult,
  openAddCreditDialog,
} from "../../shared/add-credit-dialog.component";
import {
  AdjustPaymentDialogComponent,
  AdjustPaymentDialogResultType,
} from "../../shared/adjust-payment-dialog/adjust-payment-dialog.component";
import { FreeTrial } from "../../types/free-trial";

@Component({
  templateUrl: "./organization-payment-method.component.html",
})
export class OrganizationPaymentMethodComponent implements OnDestroy {
  organizationId: string;
  isUnpaid = false;
  accountCredit: number;
  paymentSource?: PaymentSourceResponse;
  subscriptionStatus?: string;
  protected freeTrialData: FreeTrial;
  organization: Organization;
  organizationSubscriptionResponse: OrganizationSubscriptionResponse;

  loading = true;

  protected readonly Math = Math;
  launchPaymentModalAutomatically = false;

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
  ) {
    this.activatedRoute.params
      .pipe(
        takeUntilDestroyed(),
        switchMap(({ organizationId }) => {
          if (this.platformUtilsService.isSelfHost()) {
            return from(this.router.navigate(["/settings/subscription"]));
          }

          this.organizationId = organizationId;
          return from(this.load());
        }),
      )
      .subscribe();

    const state = this.router.getCurrentNavigation()?.extras?.state;
    // incase the above state is undefined or null we use redundantState
    const redundantState: any = location.getState();
    if (state && Object.prototype.hasOwnProperty.call(state, "launchPaymentModalAutomatically")) {
      this.launchPaymentModalAutomatically = state.launchPaymentModalAutomatically;
    } else if (
      redundantState &&
      Object.prototype.hasOwnProperty.call(redundantState, "launchPaymentModalAutomatically")
    ) {
      this.launchPaymentModalAutomatically = redundantState.launchPaymentModalAutomatically;
    } else {
      this.launchPaymentModalAutomatically = false;
    }
  }
  ngOnDestroy(): void {
    this.launchPaymentModalAutomatically = false;
  }

  protected addAccountCredit = async (): Promise<void> => {
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
    const { accountCredit, paymentSource, subscriptionStatus } =
      await this.billingApiService.getOrganizationPaymentMethod(this.organizationId);
    this.accountCredit = accountCredit;
    this.paymentSource = paymentSource;
    this.subscriptionStatus = subscriptionStatus;

    if (this.organizationId) {
      const organizationSubscriptionPromise = this.organizationApiService.getSubscription(
        this.organizationId,
      );
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const organizationPromise = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );

      [this.organizationSubscriptionResponse, this.organization] = await Promise.all([
        organizationSubscriptionPromise,
        organizationPromise,
      ]);
      this.freeTrialData = this.trialFlowService.checkForOrgsWithUpcomingPaymentIssues(
        this.organization,
        this.organizationSubscriptionResponse,
        paymentSource,
      );
    }
    this.isUnpaid = this.subscriptionStatus === "unpaid" ?? false;
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
    this.loading = false;
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
    const dialogRef = AdjustPaymentDialogComponent.open(this.dialogService, {
      data: {
        initialPaymentMethod: this.paymentSource?.type,
        organizationId: this.organizationId,
        productTier: this.organization?.productTierType,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result === AdjustPaymentDialogResultType.Submitted) {
      this.location.replaceState(this.location.path(), "", {});
      if (this.launchPaymentModalAutomatically && !this.organization.enabled) {
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
      title: null,
      message: this.i18nService.t("verifiedBankAccount"),
    });
  };

  protected get accountCreditHeaderText(): string {
    const key = this.accountCredit <= 0 ? "accountBalance" : "accountCredit";
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
        return ["bwi-bank"];
      case PaymentMethodType.Check:
        return ["bwi-money"];
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
}
