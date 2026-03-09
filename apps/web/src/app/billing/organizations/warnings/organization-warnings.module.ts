import { NgModule } from "@angular/core";

import { OrganizationBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

@NgModule({
  providers: [OrganizationBillingClient, OrganizationWarningsService],
})
export class OrganizationWarningsModule {}
