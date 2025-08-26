import { NgModule } from "@angular/core";

import {
  PasswordCalloutComponent,
  UserVerificationFormInputComponent,
  VaultTimeoutInputComponent,
} from "@bitwarden/auth/angular";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";

import { VerifyRecoverDeleteOrgComponent } from "../admin-console/organizations/manage/verify-recover-delete-org.component";
import { RecoverDeleteComponent } from "../auth/recover-delete.component";
import { RecoverTwoFactorComponent } from "../auth/recover-two-factor.component";
import { DangerZoneComponent } from "../auth/settings/account/danger-zone.component";
import { UserVerificationModule } from "../auth/shared/components/user-verification";
import { VerifyEmailTokenComponent } from "../auth/verify-email-token.component";
import { VerifyRecoverDeleteComponent } from "../auth/verify-recover-delete.component";
import { FreeBitwardenFamiliesComponent } from "../billing/members/free-bitwarden-families.component";
import { SponsoredFamiliesComponent } from "../billing/settings/sponsored-families.component";
import { SponsoringOrgRowComponent } from "../billing/settings/sponsoring-org-row.component";
// eslint-disable-next-line no-restricted-imports -- Temporarily disabled until DIRT refactors these out of this module
import { ExposedPasswordsReportComponent as OrgExposedPasswordsReportComponent } from "../dirt/reports/pages/organizations/exposed-passwords-report.component";
// eslint-disable-next-line no-restricted-imports -- Temporarily disabled until DIRT refactors these out of this module
import { InactiveTwoFactorReportComponent as OrgInactiveTwoFactorReportComponent } from "../dirt/reports/pages/organizations/inactive-two-factor-report.component";
// eslint-disable-next-line no-restricted-imports -- Temporarily disabled until DIRT refactors these out of this module
import { ReusedPasswordsReportComponent as OrgReusedPasswordsReportComponent } from "../dirt/reports/pages/organizations/reused-passwords-report.component";
// eslint-disable-next-line no-restricted-imports -- Temporarily disabled until DIRT refactors these out of this module
import { UnsecuredWebsitesReportComponent as OrgUnsecuredWebsitesReportComponent } from "../dirt/reports/pages/organizations/unsecured-websites-report.component";
// eslint-disable-next-line no-restricted-imports -- Temporarily disabled until DIRT refactors these out of this module
import { WeakPasswordsReportComponent as OrgWeakPasswordsReportComponent } from "../dirt/reports/pages/organizations/weak-passwords-report.component";
import { RemovePasswordComponent } from "../key-management/key-connector/remove-password.component";
import { HeaderModule } from "../layouts/header/header.module";
import { PremiumBadgeComponent } from "../vault/components/premium-badge.component";
import { OrganizationBadgeModule } from "../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../vault/individual-vault/pipes/pipes.module";

import { AccountFingerprintComponent } from "./components/account-fingerprint/account-fingerprint.component";
import { SharedModule } from "./shared.module";

// Please do not add to this list of declarations - we should refactor these into modules when doing so makes sense until there are none left.
// If you are building new functionality, please create or extend a feature module instead.
@NgModule({
  imports: [
    SharedModule,
    UserVerificationModule,
    AccountFingerprintComponent,
    OrganizationBadgeModule,
    PipesModule,
    PasswordCalloutComponent,
    UserVerificationFormInputComponent,
    DangerZoneComponent,
    LayoutComponent,
    NavigationModule,
    HeaderModule,
    VerifyRecoverDeleteOrgComponent,
    VaultTimeoutInputComponent,
    PremiumBadgeComponent,
  ],
  declarations: [
    OrgExposedPasswordsReportComponent,
    OrgInactiveTwoFactorReportComponent,
    OrgReusedPasswordsReportComponent,
    OrgUnsecuredWebsitesReportComponent,
    OrgWeakPasswordsReportComponent,
    RecoverDeleteComponent,
    RecoverTwoFactorComponent,
    RemovePasswordComponent,
    SponsoredFamiliesComponent,
    FreeBitwardenFamiliesComponent,
    SponsoringOrgRowComponent,
    VerifyEmailTokenComponent,
    VerifyRecoverDeleteComponent,
  ],
  exports: [
    UserVerificationModule,
    PremiumBadgeComponent,
    OrgExposedPasswordsReportComponent,
    OrgInactiveTwoFactorReportComponent,
    OrgReusedPasswordsReportComponent,
    OrgUnsecuredWebsitesReportComponent,
    OrgWeakPasswordsReportComponent,
    PremiumBadgeComponent,
    RecoverDeleteComponent,
    RecoverTwoFactorComponent,
    RemovePasswordComponent,
    SponsoredFamiliesComponent,
    FreeBitwardenFamiliesComponent,
    SponsoringOrgRowComponent,
    VerifyEmailTokenComponent,
    VerifyRecoverDeleteComponent,
    HeaderModule,
    DangerZoneComponent,
  ],
})
export class LooseComponentsModule {}
