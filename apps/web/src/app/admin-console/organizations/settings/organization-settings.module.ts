import { NgModule } from "@angular/core";

import { ItemModule } from "@bitwarden/components";

import { DangerZoneComponent } from "../../../auth/settings/account/danger-zone.component";
import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { AccountFingerprintComponent } from "../../../shared/components/account-fingerprint/account-fingerprint.component";
import { PremiumBadgeComponent } from "../../../vault/components/premium-badge.component";
import { PoliciesModule } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { OrganizationSettingsRoutingModule } from "./organization-settings-routing.module";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

@NgModule({
  imports: [
    SharedModule,
    PoliciesModule,
    OrganizationSettingsRoutingModule,
    AccountFingerprintComponent,
    DangerZoneComponent,
    HeaderModule,
    PremiumBadgeComponent,
    ItemModule,
  ],
  declarations: [AccountComponent, TwoFactorSetupComponent],
})
export class OrganizationSettingsModule {}
