import { NgModule } from "@angular/core";

import {
  PasswordCalloutComponent,
  UserVerificationFormInputComponent,
  VaultTimeoutInputComponent,
} from "@bitwarden/auth/angular";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";

import { OrganizationLayoutComponent } from "../admin-console/organizations/layouts/organization-layout.component";
import { EventsComponent as OrgEventsComponent } from "../admin-console/organizations/manage/events.component";
import { UserConfirmComponent as OrgUserConfirmComponent } from "../admin-console/organizations/manage/user-confirm.component";
import { VerifyRecoverDeleteOrgComponent } from "../admin-console/organizations/manage/verify-recover-delete-org.component";
import { AcceptFamilySponsorshipComponent } from "../admin-console/organizations/sponsorships/accept-family-sponsorship.component";
import { HintComponent } from "../auth/hint.component";
import { RecoverDeleteComponent } from "../auth/recover-delete.component";
import { RecoverTwoFactorComponent } from "../auth/recover-two-factor.component";
import { RemovePasswordComponent } from "../auth/remove-password.component";
import { SetPasswordComponent } from "../auth/set-password.component";
import { AccountComponent } from "../auth/settings/account/account.component";
import { ChangeAvatarDialogComponent } from "../auth/settings/account/change-avatar-dialog.component";
import { ChangeEmailComponent } from "../auth/settings/account/change-email.component";
import { DangerZoneComponent } from "../auth/settings/account/danger-zone.component";
import { DeauthorizeSessionsComponent } from "../auth/settings/account/deauthorize-sessions.component";
import { DeleteAccountDialogComponent } from "../auth/settings/account/delete-account-dialog.component";
import { ProfileComponent } from "../auth/settings/account/profile.component";
import { EmergencyAccessAttachmentsComponent } from "../auth/settings/emergency-access/attachments/emergency-access-attachments.component";
import { EmergencyAccessConfirmComponent } from "../auth/settings/emergency-access/confirm/emergency-access-confirm.component";
import { EmergencyAccessAddEditComponent } from "../auth/settings/emergency-access/emergency-access-add-edit.component";
import { EmergencyAccessComponent } from "../auth/settings/emergency-access/emergency-access.component";
import { EmergencyAccessTakeoverComponent } from "../auth/settings/emergency-access/takeover/emergency-access-takeover.component";
import { EmergencyAccessViewComponent } from "../auth/settings/emergency-access/view/emergency-access-view.component";
import { ApiKeyComponent } from "../auth/settings/security/api-key.component";
import { ChangeKdfModule } from "../auth/settings/security/change-kdf/change-kdf.module";
import { SecurityKeysComponent } from "../auth/settings/security/security-keys.component";
import { SecurityComponent } from "../auth/settings/security/security.component";
import { TwoFactorRecoveryComponent } from "../auth/settings/two-factor/two-factor-recovery.component";
import { TwoFactorSetupAuthenticatorComponent } from "../auth/settings/two-factor/two-factor-setup-authenticator.component";
import { TwoFactorSetupDuoComponent } from "../auth/settings/two-factor/two-factor-setup-duo.component";
import { TwoFactorSetupEmailComponent } from "../auth/settings/two-factor/two-factor-setup-email.component";
import { TwoFactorSetupWebAuthnComponent } from "../auth/settings/two-factor/two-factor-setup-webauthn.component";
import { TwoFactorSetupYubiKeyComponent } from "../auth/settings/two-factor/two-factor-setup-yubikey.component";
import { TwoFactorSetupComponent } from "../auth/settings/two-factor/two-factor-setup.component";
import { TwoFactorVerifyComponent } from "../auth/settings/two-factor/two-factor-verify.component";
import { UserVerificationModule } from "../auth/shared/components/user-verification";
import { SsoComponentV1 } from "../auth/sso-v1.component";
import { TwoFactorOptionsComponentV1 } from "../auth/two-factor-options-v1.component";
import { TwoFactorComponentV1 } from "../auth/two-factor-v1.component";
import { UpdatePasswordComponent } from "../auth/update-password.component";
import { UpdateTempPasswordComponent } from "../auth/update-temp-password.component";
import { VerifyEmailTokenComponent } from "../auth/verify-email-token.component";
import { VerifyRecoverDeleteComponent } from "../auth/verify-recover-delete.component";
import { SponsoredFamiliesComponent } from "../billing/settings/sponsored-families.component";
import { SponsoringOrgRowComponent } from "../billing/settings/sponsoring-org-row.component";
import { DynamicAvatarComponent } from "../components/dynamic-avatar.component";
import { SelectableAvatarComponent } from "../components/selectable-avatar.component";
import { FrontendLayoutComponent } from "../layouts/frontend-layout.component";
import { HeaderModule } from "../layouts/header/header.module";
import { ProductSwitcherModule } from "../layouts/product-switcher/product-switcher.module";
import { UserLayoutComponent } from "../layouts/user-layout.component";
import { DomainRulesComponent } from "../settings/domain-rules.component";
import { PreferencesComponent } from "../settings/preferences.component";
/* eslint no-restricted-imports: "off" -- Temporarily disabled until Tools refactors these out of this module */
import { ExposedPasswordsReportComponent as OrgExposedPasswordsReportComponent } from "../tools/reports/pages/organizations/exposed-passwords-report.component";
import { InactiveTwoFactorReportComponent as OrgInactiveTwoFactorReportComponent } from "../tools/reports/pages/organizations/inactive-two-factor-report.component";
import { ReusedPasswordsReportComponent as OrgReusedPasswordsReportComponent } from "../tools/reports/pages/organizations/reused-passwords-report.component";
import { UnsecuredWebsitesReportComponent as OrgUnsecuredWebsitesReportComponent } from "../tools/reports/pages/organizations/unsecured-websites-report.component";
import { WeakPasswordsReportComponent as OrgWeakPasswordsReportComponent } from "../tools/reports/pages/organizations/weak-passwords-report.component";
/* eslint no-restricted-imports: "error" */
import { AddEditComponent as SendAddEditComponent } from "../tools/send/add-edit.component";
import { PremiumBadgeComponent } from "../vault/components/premium-badge.component";
import { AddEditCustomFieldsComponent } from "../vault/individual-vault/add-edit-custom-fields.component";
import { AddEditComponent } from "../vault/individual-vault/add-edit.component";
import { AttachmentsComponent } from "../vault/individual-vault/attachments.component";
import { FolderAddEditComponent } from "../vault/individual-vault/folder-add-edit.component";
import { OrganizationBadgeModule } from "../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../vault/individual-vault/pipes/pipes.module";
import { AddEditComponent as OrgAddEditComponent } from "../vault/org-vault/add-edit.component";
import { AttachmentsComponent as OrgAttachmentsComponent } from "../vault/org-vault/attachments.component";
import { PurgeVaultComponent } from "../vault/settings/purge-vault.component";

import { EnvironmentSelectorModule } from "./../components/environment-selector/environment-selector.module";
import { AccountFingerprintComponent } from "./components/account-fingerprint/account-fingerprint.component";
import { SharedModule } from "./shared.module";

// Please do not add to this list of declarations - we should refactor these into modules when doing so makes sense until there are none left.
// If you are building new functionality, please create or extend a feature module instead.
@NgModule({
  imports: [
    SharedModule,
    ProductSwitcherModule,
    UserVerificationModule,
    ChangeKdfModule,
    DynamicAvatarComponent,
    EnvironmentSelectorModule,
    AccountFingerprintComponent,
    OrganizationBadgeModule,
    PipesModule,
    PasswordCalloutComponent,
    UserVerificationFormInputComponent,
    DangerZoneComponent,
    LayoutComponent,
    NavigationModule,
    HeaderModule,
    OrganizationLayoutComponent,
    UserLayoutComponent,
    VerifyRecoverDeleteOrgComponent,
    VaultTimeoutInputComponent,
  ],
  declarations: [
    AcceptFamilySponsorshipComponent,
    AccountComponent,
    AddEditComponent,
    AddEditCustomFieldsComponent,
    AddEditCustomFieldsComponent,
    ApiKeyComponent,
    AttachmentsComponent,
    ChangeEmailComponent,
    DeauthorizeSessionsComponent,
    DeleteAccountDialogComponent,
    DomainRulesComponent,
    EmergencyAccessAddEditComponent,
    EmergencyAccessAttachmentsComponent,
    EmergencyAccessComponent,
    EmergencyAccessConfirmComponent,
    EmergencyAccessTakeoverComponent,
    EmergencyAccessViewComponent,
    FolderAddEditComponent,
    FrontendLayoutComponent,
    HintComponent,
    OrgAddEditComponent,
    OrgAttachmentsComponent,
    OrgEventsComponent,
    OrgExposedPasswordsReportComponent,
    OrgInactiveTwoFactorReportComponent,
    OrgReusedPasswordsReportComponent,
    OrgUnsecuredWebsitesReportComponent,
    OrgUserConfirmComponent,
    OrgWeakPasswordsReportComponent,
    PreferencesComponent,
    PremiumBadgeComponent,
    ProfileComponent,
    ChangeAvatarDialogComponent,
    PurgeVaultComponent,
    RecoverDeleteComponent,
    RecoverTwoFactorComponent,
    RemovePasswordComponent,
    SecurityComponent,
    SecurityKeysComponent,
    SelectableAvatarComponent,
    SendAddEditComponent,
    SetPasswordComponent,
    SponsoredFamiliesComponent,
    SponsoringOrgRowComponent,
    TwoFactorComponentV1,
    SsoComponentV1,
    TwoFactorSetupAuthenticatorComponent,
    TwoFactorSetupDuoComponent,
    TwoFactorSetupEmailComponent,
    TwoFactorOptionsComponentV1,
    TwoFactorRecoveryComponent,
    TwoFactorSetupComponent,
    TwoFactorVerifyComponent,
    TwoFactorSetupWebAuthnComponent,
    TwoFactorSetupYubiKeyComponent,
    UpdatePasswordComponent,
    UpdateTempPasswordComponent,
    VerifyEmailTokenComponent,
    VerifyRecoverDeleteComponent,
  ],
  exports: [
    UserVerificationModule,
    PremiumBadgeComponent,
    AccountComponent,
    AddEditComponent,
    AddEditCustomFieldsComponent,
    AddEditCustomFieldsComponent,
    ApiKeyComponent,
    AttachmentsComponent,
    ChangeEmailComponent,
    DeauthorizeSessionsComponent,
    DeleteAccountDialogComponent,
    DomainRulesComponent,
    DynamicAvatarComponent,
    EmergencyAccessAddEditComponent,
    EmergencyAccessAttachmentsComponent,
    EmergencyAccessComponent,
    EmergencyAccessConfirmComponent,
    EmergencyAccessTakeoverComponent,
    EmergencyAccessViewComponent,
    FolderAddEditComponent,
    FrontendLayoutComponent,
    HintComponent,
    OrgAddEditComponent,
    OrganizationLayoutComponent,
    OrgAttachmentsComponent,
    OrgEventsComponent,
    OrgExposedPasswordsReportComponent,
    OrgInactiveTwoFactorReportComponent,
    OrgReusedPasswordsReportComponent,
    OrgUnsecuredWebsitesReportComponent,
    OrgUserConfirmComponent,
    OrgWeakPasswordsReportComponent,
    PreferencesComponent,
    PremiumBadgeComponent,
    ProfileComponent,
    ChangeAvatarDialogComponent,
    PurgeVaultComponent,
    RecoverDeleteComponent,
    RecoverTwoFactorComponent,
    RemovePasswordComponent,
    SecurityComponent,
    SecurityKeysComponent,
    SelectableAvatarComponent,
    SendAddEditComponent,
    SetPasswordComponent,
    SponsoredFamiliesComponent,
    SponsoringOrgRowComponent,
    TwoFactorComponentV1,
    SsoComponentV1,
    TwoFactorSetupAuthenticatorComponent,
    TwoFactorSetupDuoComponent,
    TwoFactorSetupEmailComponent,
    TwoFactorOptionsComponentV1,
    TwoFactorSetupComponent,
    TwoFactorVerifyComponent,
    TwoFactorSetupWebAuthnComponent,
    TwoFactorSetupYubiKeyComponent,
    UpdateTempPasswordComponent,
    UpdatePasswordComponent,
    UserLayoutComponent,
    VerifyEmailTokenComponent,
    VerifyRecoverDeleteComponent,
    HeaderModule,
    DangerZoneComponent,
  ],
})
export class LooseComponentsModule {}
