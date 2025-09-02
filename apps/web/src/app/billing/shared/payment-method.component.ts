import { ActivatedRoute, Router } from "@angular/router";
import { AddCreditDialogResult, openAddCreditDialog } from "./add-credit-dialog.component";
import {
  AdjustPaymentDialogComponent,
  AdjustPaymentDialogResultType,
} from "./adjust-payment-dialog/adjust-payment-dialog.component";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { DialogService, ToastService } from "@bitwarden/components";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import {
  OrganizationService,
  getOrganizationById,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { firstValueFrom, lastValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingPaymentResponse } from "@bitwarden/common/billing/models/response/billing-payment.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Location } from "@angular/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SubscriptionResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { SyncService } from "@bitwarden/common/platform/sync";
import { VerifyBankRequest } from "@bitwarden/common/models/request/verify-bank.request";

@Component({
  templateUrl: "payment-method.component.html",
  standalone: false,
})
export class PaymentMethodComponent implements OnInit, OnDestroy {
  loading = false;
  firstLoaded = false;
  billing?: BillingPaymentResponse;
  org?: OrganizationSubscriptionResponse;
  sub?: SubscriptionResponse;
  paymentMethodType = PaymentMethodType;
  organizationId?: string;
  isUnpaid = false;
  organization?: Organization;

  verifyBankForm = this.formBuilder.group({
    amount1: new FormControl<number>(0, [
      Validators.required,
      Validators.max(99),
      Validators.min(0),
    ]),
    amount2: new FormControl<number>(0, [
      Validators.required,
      Validators.max(99),
      Validators.min(0),
    ]),
  });

  launchPaymentModalAutomatically = false;
  constructor(
    protected apiService: ApiService,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private dialogService: DialogService,
    private toastService: ToastService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    protected syncService: SyncService,
    private configService: ConfigService,
  ) {
    const state = this.router.getCurrentNavigation()?.extras?.state;
    // In case the above state is undefined or null, we use redundantState
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

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.params.subscribe(async (params) => {
      if (params.organizationId) {
        this.organizationId = params.organizationId;
      } else if (this.platformUtilsService.isSelfHost()) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/settings/subscription"]);
        return;
      }

      const managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
        FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
      );

      if (managePaymentDetailsOutsideCheckout) {
        await this.router.navigate(["../payment-details"], { relativeTo: this.route });
      }

      await this.load();
      this.firstLoaded = true;
    });
  }

  load = async () => {
    if (this.loading) {
      return;
    }
    this.loading = true;
    if (this.forOrganization) {
      const billingPromise = this.organizationApiService.getBilling(this.organizationId!);
      const organizationSubscriptionPromise = this.organizationApiService.getSubscription(
        this.organizationId!,
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
          .pipe(getOrganizationById(this.organizationId!)),
      );

      [this.billing, this.org, this.organization] = await Promise.all([
        billingPromise,
        organizationSubscriptionPromise,
        organizationPromise,
      ]);
    } else {
      const billingPromise = this.apiService.getUserBillingPayment();
      const subPromise = this.apiService.getUserSubscription();

      [this.billing, this.sub] = await Promise.all([billingPromise, subPromise]);
    }
    // TODO: Eslint upgrade. Please resolve this since the ?? does nothing
    // eslint-disable-next-line no-constant-binary-expression
    this.isUnpaid = this.subscription?.status === "unpaid" ?? false;
    this.loading = false;
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
  };

  addCredit = async () => {
    if (this.forOrganization) {
      const dialogRef = openAddCreditDialog(this.dialogService, {
        data: {
          organizationId: this.organizationId!,
        },
      });
      const result = await lastValueFrom(dialogRef.closed);
      if (result === AddCreditDialogResult.Added) {
        await this.load();
      }
    }
  };

  changePayment = async () => {
    const dialogRef = AdjustPaymentDialogComponent.open(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        initialPaymentMethod: this.paymentSource !== null ? this.paymentSource.type : null,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === AdjustPaymentDialogResultType.Submitted) {
      this.location.replaceState(this.location.path(), "", {});
      if (this.launchPaymentModalAutomatically && !this.organization?.enabled) {
        await this.syncService.fullSync(true);
      }
      this.launchPaymentModalAutomatically = false;
      await this.load();
    }
  };

  verifyBank = async () => {
    if (this.loading || !this.forOrganization) {
      return;
    }

    const request = new VerifyBankRequest();
    request.amount1 = this.verifyBankForm.value.amount1!;
    request.amount2 = this.verifyBankForm.value.amount2!;
    await this.organizationApiService.verifyBank(this.organizationId!, request);
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("verifiedBankAccount"),
    });
    await this.load();
  };

  get isCreditBalance() {
    return this.billing == null || this.billing.balance <= 0;
  }

  get creditOrBalance() {
    return Math.abs(this.billing != null ? this.billing.balance : 0);
  }

  get paymentSource() {
    return this.billing != null ? this.billing.paymentSource : null;
  }

  get forOrganization() {
    return this.organizationId != null;
  }

  get paymentSourceClasses() {
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

  get subscription() {
    return this.sub?.subscription ?? this.org?.subscription ?? null;
  }

  ngOnDestroy(): void {
    this.launchPaymentModalAutomatically = false;
  }
}
