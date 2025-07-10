import { NgModule } from "@angular/core";

import { ItemModule } from "@bitwarden/components";

import { LooseComponentsModule, SharedModule } from "../../../shared";
import { AccountFingerprintComponent } from "../../../shared/components/account-fingerprint/account-fingerprint.component";
import { PoliciesModule } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { OrganizationSettingsRoutingModule } from "./organization-settings-routing.module";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

@NgModule({
  imports: [
    SharedModule,
    LooseComponentsModule,
    PoliciesModule,
    OrganizationSettingsRoutingModule,
    AccountFingerprintComponent,
    ItemModule,
  ],
  declarations: [AccountComponent, TwoFactorSetupComponent],
})
export class OrganizationSettingsModule {}
