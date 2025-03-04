import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { AddCreditDialogComponent } from "./add-credit-dialog.component";
import { AdjustPaymentDialogComponent } from "./adjust-payment-dialog/adjust-payment-dialog.component";
import { AdjustStorageDialogComponent } from "./adjust-storage-dialog/adjust-storage-dialog.component";
import { BillingHistoryComponent } from "./billing-history.component";
import { OffboardingSurveyComponent } from "./offboarding-survey.component";
import { PaymentComponent } from "./payment/payment.component";
import { PaymentMethodComponent } from "./payment-method.component";
import { IndividualSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/individual-self-hosting-license-uploader.component";
import { OrganizationSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/organization-self-hosting-license-uploader.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";
import { TaxInfoComponent } from "./tax-info.component";
import { UpdateLicenseDialogComponent } from "./update-license-dialog.component";
import { UpdateLicenseComponent } from "./update-license.component";
import { VerifyBankAccountComponent } from "./verify-bank-account/verify-bank-account.component";

@NgModule({
  imports: [
    SharedModule,
    TaxInfoComponent,
    HeaderModule,
    BannerModule,
    PaymentComponent,
    VerifyBankAccountComponent,
  ],
  declarations: [
    AddCreditDialogComponent,
    BillingHistoryComponent,
    PaymentMethodComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    AdjustPaymentDialogComponent,
    AdjustStorageDialogComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
  ],
  exports: [
    SharedModule,
    TaxInfoComponent,
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    VerifyBankAccountComponent,
    PaymentComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
  ],
})
export class BillingSharedModule {}
