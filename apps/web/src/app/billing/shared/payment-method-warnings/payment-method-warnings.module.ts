import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { PaymentMethodWarningsComponent } from "./payment-method-warnings.component";

@NgModule({
  imports: [BannerModule, SharedModule],
  declarations: [PaymentMethodWarningsComponent],
  exports: [PaymentMethodWarningsComponent],
})
export class PaymentMethodWarningsModule {}
