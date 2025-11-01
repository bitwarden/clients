import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { AdjustStorageDialogComponent } from "./adjust-storage-dialog/adjust-storage-dialog.component";
import { BillingHistoryComponent } from "./billing-history.component";
import { OffboardingSurveyComponent } from "./offboarding-survey.component";
import { PlanCardComponent } from "./plan-card/plan-card.component";
import { PricingSummaryComponent } from "./pricing-summary/pricing-summary.component";
import { IndividualSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/individual-self-hosting-license-uploader.component";
import { OrganizationSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/organization-self-hosting-license-uploader.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";
import { TrialPaymentDialogComponent } from "./trial-payment-dialog/trial-payment-dialog.component";
import { UpdateLicenseDialogComponent } from "./update-license-dialog.component";
import { UpdateLicenseComponent } from "./update-license.component";

@NgModule({
  imports: [
    SharedModule,
    HeaderModule,
    BannerModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
  ],
  declarations: [
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
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
  ],
})
export class BillingSharedModule {}
