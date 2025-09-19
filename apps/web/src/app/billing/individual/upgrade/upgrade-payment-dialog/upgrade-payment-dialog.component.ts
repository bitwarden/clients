import { DialogConfig } from "@angular/cdk/dialog";
import { Component, Inject, OnInit, ViewChild, OnDestroy } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Subject, takeUntil, debounceTime, from, Observable, map, tap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { PreviewIndividualInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-individual-invoice.request";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { CartSummaryComponent, LineItem } from "@bitwarden/pricing";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { EnterPaymentMethodComponent } from "../../../payment/components";
import { BillingServicesModule } from "../../../services";
import { BitwardenSubscriber } from "../../../types";
import { DialogPlanType } from "../upgrade-account-dialog/upgrade-account-dialog.component";

/**
 * Status types for upgrade payment dialog
 */
export const UpgradePaymentDialogResult = {
  Back: "back",
  UpgradedToPremium: "upgradedToPremium",
  UpgradedToFamilies: "upgradedToFamilies",
} as const;

export type UpgradePaymentDialogResult = UnionOfValues<typeof UpgradePaymentDialogResult>;

/**
 * Parameters for upgrade payment dialog
 */
export type UpgradePaymentDialogParams = {
  plan: DialogPlanType;
  subscriber: BitwardenSubscriber;
};

@Component({
  selector: "app-upgrade-payment-dialog",
  imports: [
    SharedModule,
    CartSummaryComponent,
    ButtonModule,
    EnterPaymentMethodComponent,
    BillingServicesModule,
  ],
  templateUrl: "./upgrade-payment-dialog.component.html",
})
export class UpgradePaymentDialogComponent implements OnInit, OnDestroy {
  @ViewChild(EnterPaymentMethodComponent) paymentComponent!: EnterPaymentMethodComponent;

  protected formGroup = new FormGroup({
    organizationName: new FormControl<string>("", [Validators.required]),
    paymentForm: EnterPaymentMethodComponent.getFormGroup(),
  });
  protected loading = true;
  private destroy$ = new Subject<void>();
  private plansResponse$: Observable<ListResponse<PlanResponse>> = from(this.apiService.getPlans());

  // Cart summary data
  passwordManager!: LineItem;
  additionalStorage?: LineItem;
  secretsManager?: { seats: LineItem; additionalServiceAccounts?: LineItem };
  estimatedTax!: number;
  planName!: string;
  upgradeMessage!: string;
  familiesPlanDetails!: PlanResponse;

  constructor(
    private dialogRef: DialogRef<UpgradePaymentDialogResult>,
    private i18nService: I18nService,
    private apiService: ApiService,
    private taxService: TaxServiceAbstraction,
    private toastService: ToastService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    @Inject(DIALOG_DATA) private dialogParams: UpgradePaymentDialogParams,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.isFamiliesPlan) {
      this.formGroup.controls.organizationName.disable();
    }

    this.plansResponse$
      .pipe(
        map((responses) => responses.data),
        tap((plansResponse) => {
          if (this.isFamiliesPlan) {
            const familiesPlan = plansResponse.find(
              (plan) => plan.type === PlanType.FamiliesAnnually,
            );
            if (familiesPlan) {
              this.familiesPlanDetails = familiesPlan;
              this.passwordManager = {
                name: "familiesMembership",
                cost: this.familiesPlanDetails.PasswordManager.basePrice,
                quantity: 1,
                cadence: "year",
              };
            }
          }
          if (this.isPremiumPlan) {
            this.passwordManager = {
              name: "premiumMembership",
              // Premium is not in the plans API, so hardcoding for now
              cost: 10,
              quantity: 1,
              cadence: "year",
            };
          }
          this.loading = false;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.estimatedTax = 0;
    this.planName = this.formatPlanName(this.dialogParams.plan);
    this.upgradeMessage = this.i18nService.t("upgradeToPlan", this.planName);
    this.formGroup.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => this.refreshSalesTax());
  }

  get isFamiliesPlan(): boolean {
    return this.dialogParams.plan === DialogPlanType.Families;
  }
  get isPremiumPlan(): boolean {
    return this.dialogParams.plan === DialogPlanType.Premium;
  }

  back = () => {
    this.close(UpgradePaymentDialogResult.Back);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  static open(
    dialogService: DialogService,
    dialogConfig: DialogConfig<UpgradePaymentDialogParams>,
  ): DialogRef<UpgradePaymentDialogResult> {
    return dialogService.open<UpgradePaymentDialogResult>(
      UpgradePaymentDialogComponent,
      dialogConfig,
    );
  }

  submit = async (): Promise<void> => {
    if (!this.isFormValid()) {
      this.formGroup.markAllAsTouched();
      return;
    }

    try {
      if (this.isFamiliesPlan) {
        await this.processFamiliesUpgrade();
      } else {
        await this.processPremiumUpgrade();
      }
    } catch (error: unknown) {
      this.logService.error(error);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("upgradeError"),
      });
    }
  };

  private isFormValid(): boolean {
    return this.formGroup.valid && this.paymentComponent.validate();
  }

  private async processFamiliesUpgrade(): Promise<void> {
    // await this.upgradeToFamiliesOrganization();
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("familiesUpdated"),
    });
    this.close(UpgradePaymentDialogResult.UpgradedToFamilies);
  }

  private async processPremiumUpgrade(): Promise<void> {
    // await this.upgradeToPremiumUser();
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("premiumUpdated"),
    });
    this.close(UpgradePaymentDialogResult.UpgradedToPremium);
  }

  private close(result: UpgradePaymentDialogResult) {
    this.dialogRef.close(result);
  }

  private async upgradeToPremiumUser(): Promise<void> {
    const { type, token } = await this.paymentComponent.tokenize();
    const postalCode = this.formGroup.value.paymentForm?.billingAddress?.postalCode;
    const country = this.formGroup.value.paymentForm?.billingAddress?.country;

    if (!type || !token) {
      throw new Error("Payment method type or token is missing");
    }

    if (!country || !postalCode) {
      throw new Error("Billing address information is incomplete");
    }

    const formData = new FormData();
    formData.append("paymentMethodType", type.toString());
    formData.append("paymentToken", token);
    formData.append("country", country);
    formData.append("postalCode", postalCode);

    await this.apiService.postPremium(formData);
  }

  private async refreshSalesTax(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    const billingAddress = this.formGroup.value.paymentForm?.billingAddress;
    if (!billingAddress?.postalCode || !billingAddress?.country) {
      return;
    }

    switch (this.dialogParams.plan) {
      case DialogPlanType.Families:
        await this.calculateEstimatedTaxForFamiliesPlan(billingAddress);
        break;
      case DialogPlanType.Premium:
        await this.calculateEstimatedTaxForPremiumPlan(billingAddress);
        break;
    }
  }

  private async calculateEstimatedTaxForFamiliesPlan(billingAddress: any): Promise<void> {
    const request: PreviewOrganizationInvoiceRequest = {
      passwordManager: {
        additionalStorage: 0,
        plan: PlanType.FamiliesAnnually,
        seats: this.familiesPlanDetails.PasswordManager.baseSeats,
      },
      taxInformation: {
        postalCode: billingAddress.postalCode,
        country: billingAddress.country,
        // No tax ID required for families plan
        taxId: null,
      },
    };

    await this.taxService
      .previewOrganizationInvoice(request)
      .then((invoice) => {
        this.estimatedTax = invoice.taxAmount;
      })
      .catch((error: unknown) => {
        this.logService.error(error);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("taxCalculationError"),
        });
      });
  }

  private async calculateEstimatedTaxForPremiumPlan(billingAddress: any): Promise<void> {
    const request: PreviewIndividualInvoiceRequest = {
      passwordManager: {
        additionalStorage: 0,
      },
      taxInformation: {
        postalCode: billingAddress.postalCode,
        country: billingAddress.country,
      },
    };

    await this.taxService
      .previewIndividualInvoice(request)
      .then((invoice) => {
        this.estimatedTax = invoice.taxAmount;
      })
      .catch((error: unknown) => {
        this.logService.error(error);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("taxCalculationError"),
        });
      });
  }

  private formatPlanName(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}
