import { NgModule } from "@angular/core";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { AddCreditComponent } from "./add-credit.component";
import { AdjustPaymentDialogComponent } from "./adjust-payment-dialog.component";
import { AdjustStorageComponent } from "./adjust-storage.component";
import { BillingHistoryComponent } from "./billing-history.component";
import { OffboardingSurveyComponent } from "./offboarding-survey.component";
import { PaymentMethodComponent } from "./payment-method.component";
import { PaymentComponent } from "./payment.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";
import { TaxInfoComponent } from "./tax-info.component";
import { UpdateLicenseComponent } from "./update-license.component";

@NgModule({
  imports: [SharedModule, PaymentComponent, TaxInfoComponent, HeaderModule],
  declarations: [
    AddCreditComponent,
    AdjustPaymentDialogComponent,
    AdjustStorageComponent,
    BillingHistoryComponent,
    PaymentMethodComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    OffboardingSurveyComponent,
  ],
  exports: [
    SharedModule,
    PaymentComponent,
    TaxInfoComponent,
    AdjustStorageComponent,
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    OffboardingSurveyComponent,
  ],
})
export class BillingSharedModule {}
