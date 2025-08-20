import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { AddCreditDialogComponent } from "./add-credit-dialog.component";
import { AdjustStorageDialogComponent } from "./adjust-storage-dialog/adjust-storage-dialog.component";
import { BillingHistoryComponent } from "./billing-history.component";
import { OffboardingSurveyComponent } from "./offboarding-survey.component";
import { PaymentComponent } from "./payment/payment.component";
import { PlanCardComponent } from "./plan-card/plan-card.component";
import { PricingSummaryComponent } from "./pricing-summary/pricing-summary.component";
import { IndividualSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/individual-self-hosting-license-uploader.component";
import { OrganizationSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/organization-self-hosting-license-uploader.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";
import { TaxInfoComponent } from "./tax-info.component";
import { TrialPaymentDialogComponent } from "./trial-payment-dialog/trial-payment-dialog.component";
import { UpdateLicenseDialogComponent } from "./update-license-dialog.component";
import { UpdateLicenseComponent } from "./update-license.component";

@NgModule({
  imports: [SharedModule, TaxInfoComponent, HeaderModule, BannerModule, PaymentComponent],
  declarations: [
    AddCreditDialogComponent,
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    AdjustStorageDialogComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
    TrialPaymentDialogComponent,
    PlanCardComponent,
    PricingSummaryComponent,
  ],
  exports: [
    SharedModule,
    TaxInfoComponent,
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    PaymentComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
  ],
})
export class BillingSharedModule {}
