import { NgModule } from "@angular/core";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { ItemModule } from "@bitwarden/components";

import { DangerZoneComponent } from "../../../auth/settings/account/danger-zone.component";
import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { AccountFingerprintComponent } from "../../../shared/components/account-fingerprint/account-fingerprint.component";

import { AccountComponent } from "./account.component";
import { OrganizationSettingsRoutingModule } from "./organization-settings-routing.module";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

@NgModule({
  imports: [
    SharedModule,
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
