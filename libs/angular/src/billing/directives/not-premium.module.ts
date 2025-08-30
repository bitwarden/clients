import { NgModule } from "@angular/core";

import { NotPremiumDirective } from "./not-premium.directive";

@NgModule({
  declarations: [NotPremiumDirective],
  exports: [NotPremiumDirective],
})
export class NotPremiumDirectiveModule {}
