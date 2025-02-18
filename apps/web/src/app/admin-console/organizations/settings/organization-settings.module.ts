import { NgModule } from "@angular/core";

import { TwoFactorModule } from "../../../auth/settings/two-factor/two-factor.module";
import { LooseComponentsModule, SharedModule } from "../../../shared";
import { AccountFingerprintComponent } from "../../../shared/components/account-fingerprint/account-fingerprint.component";
import { PoliciesModule } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { OrganizationSettingsRoutingModule } from "./organization-settings-routing.module";

@NgModule({
  imports: [
    SharedModule,
    LooseComponentsModule,
    PoliciesModule,
    OrganizationSettingsRoutingModule,
    AccountFingerprintComponent,
    TwoFactorModule,
  ],
  declarations: [AccountComponent],
})
export class OrganizationSettingsModule {}
