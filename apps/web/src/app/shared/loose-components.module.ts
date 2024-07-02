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
import { ExposedPasswordsReportComponent as OrgExposedPasswordsReportComponent } from "../admin-console/organizations/tools/exposed-passwords-report.component";
import { InactiveTwoFactorReportComponent as OrgInactiveTwoFactorReportComponent } from "../admin-console/organizations/tools/inactive-two-factor-report.component";
import { ReusedPasswordsReportComponent as OrgReusedPasswordsReportComponent } from "../admin-console/organizations/tools/reused-passwords-report.component";
import { UnsecuredWebsitesReportComponent as OrgUnsecuredWebsitesReportComponent } from "../admin-console/organizations/tools/unsecured-websites-report.component";
import { WeakPasswordsReportComponent as OrgWeakPasswordsReportComponent } from "../admin-console/organizations/tools/weak-passwords-report.component";
import { ProvidersComponent } from "../admin-console/providers/providers.component";
import { VerifyRecoverDeleteProviderComponent } from "../admin-console/providers/verify-recover-delete-provider.component";
import { SponsoredFamiliesComponent } from "../admin-console/settings/sponsored-families.component";
import { SponsoringOrgRowComponent } from "../admin-console/settings/sponsoring-org-row.component";
import { HintComponent } from "../auth/hint.component";
import { RecoverDeleteComponent } from "../auth/recover-delete.component";
import { RecoverTwoFactorComponent } from "../auth/recover-two-factor.component";
import { RegisterFormModule } from "../auth/register-form/register-form.module";
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
import { EmergencyAddEditCipherComponent } from "../auth/settings/emergency-access/view/emergency-add-edit-cipher.component";
import { ApiKeyComponent } from "../auth/settings/security/api-key.component";
import { ChangeKdfModule } from "../auth/settings/security/change-kdf/change-kdf.module";
import { SecurityKeysComponent } from "../auth/settings/security/security-keys.component";
import { SecurityComponent } from "../auth/settings/security/security.component";
import { TwoFactorAuthenticatorComponent } from "../auth/settings/two-factor-authenticator.component";
import { TwoFactorDuoComponent } from "../auth/settings/two-factor-duo.component";
import { TwoFactorEmailComponent } from "../auth/settings/two-factor-email.component";
import { TwoFactorRecoveryComponent } from "../auth/settings/two-factor-recovery.component";
import { TwoFactorSetupComponent } from "../auth/settings/two-factor-setup.component";
import { TwoFactorVerifyComponent } from "../auth/settings/two-factor-verify.component";
import { TwoFactorWebAuthnComponent } from "../auth/settings/two-factor-webauthn.component";
import { TwoFactorYubiKeyComponent } from "../auth/settings/two-factor-yubikey.component";
import { UserVerificationModule } from "../auth/shared/components/user-verification";
import { SsoComponent } from "../auth/sso.component";
import { TwoFactorOptionsComponent } from "../auth/two-factor-options.component";
import { TwoFactorComponent } from "../auth/two-factor.component";
import { UpdatePasswordComponent } from "../auth/update-password.component";
import { UpdateTempPasswordComponent } from "../auth/update-temp-password.component";
import { VerifyEmailTokenComponent } from "../auth/verify-email-token.component";
import { VerifyRecoverDeleteComponent } from "../auth/verify-recover-delete.component";
import { PaymentMethodWarningsModule } from "../billing/shared";
import { DynamicAvatarComponent } from "../components/dynamic-avatar.component";
import { SelectableAvatarComponent } from "../components/selectable-avatar.component";
import { FrontendLayoutComponent } from "../layouts/frontend-layout.component";
import { HeaderModule } from "../layouts/header/header.module";
import { ProductSwitcherModule } from "../layouts/product-switcher/product-switcher.module";
import { UserLayoutComponent } from "../layouts/user-layout.component";
import { DomainRulesComponent } from "../settings/domain-rules.component";
import { PreferencesComponent } from "../settings/preferences.component";
import { GeneratorComponent } from "../tools/generator.component";
import { PasswordGeneratorHistoryComponent } from "../tools/password-generator-history.component";
import { AddEditComponent as SendAddEditComponent } from "../tools/send/add-edit.component";
import { PremiumBadgeComponent } from "../vault/components/premium-badge.component";
import { AddEditCustomFieldsComponent } from "../vault/individual-vault/add-edit-custom-fields.component";
import { AddEditComponent } from "../vault/individual-vault/add-edit.component";
import { AttachmentsComponent } from "../vault/individual-vault/attachments.component";
import { CollectionsComponent } from "../vault/individual-vault/collections.component";
import { FolderAddEditComponent } from "../vault/individual-vault/folder-add-edit.component";
import { OrganizationBadgeModule } from "../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../vault/individual-vault/pipes/pipes.module";
import { ShareComponent } from "../vault/individual-vault/share.component";
import { AddEditComponent as OrgAddEditComponent } from "../vault/org-vault/add-edit.component";
import { AttachmentsComponent as OrgAttachmentsComponent } from "../vault/org-vault/attachments.component";
import { CollectionsComponent as OrgCollectionsComponent } from "../vault/org-vault/collections.component";
import { PurgeVaultComponent } from "../vault/settings/purge-vault.component";

import { EnvironmentSelectorModule } from "./../components/environment-selector/environment-selector.module";
import { AccountFingerprintComponent } from "./components/account-fingerprint/account-fingerprint.component";
import { SharedModule } from "./shared.module";

// Please do not add to this list of declarations - we should refactor these into modules when doing so makes sense until there are none left.
// If you are building new functionality, please create or extend a feature module instead.
@NgModule({
  imports: [
    SharedModule,
    RegisterFormModule,
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
    PaymentMethodWarningsModule,
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
    CollectionsComponent,
    DeauthorizeSessionsComponent,
    DeleteAccountDialogComponent,
    DomainRulesComponent,
    EmergencyAccessAddEditComponent,
    EmergencyAccessAttachmentsComponent,
    EmergencyAccessComponent,
    EmergencyAccessConfirmComponent,
    EmergencyAccessTakeoverComponent,
    EmergencyAccessViewComponent,
    EmergencyAddEditCipherComponent,
    FolderAddEditComponent,
    FrontendLayoutComponent,
    HintComponent,
    OrgAddEditComponent,
    OrgAttachmentsComponent,
    OrgCollectionsComponent,
    OrgEventsComponent,
    OrgExposedPasswordsReportComponent,
    OrgInactiveTwoFactorReportComponent,
    OrgReusedPasswordsReportComponent,
    OrgUnsecuredWebsitesReportComponent,
    OrgUserConfirmComponent,
    OrgWeakPasswordsReportComponent,
    GeneratorComponent,
    PasswordGeneratorHistoryComponent,
    PreferencesComponent,
    PremiumBadgeComponent,
    ProfileComponent,
    ChangeAvatarDialogComponent,
    ProvidersComponent,
    PurgeVaultComponent,
    RecoverDeleteComponent,
    RecoverTwoFactorComponent,
    RemovePasswordComponent,
    SecurityComponent,
    SecurityKeysComponent,
    SelectableAvatarComponent,
    SendAddEditComponent,
    SetPasswordComponent,
    ShareComponent,
    SponsoredFamiliesComponent,
    SponsoringOrgRowComponent,
    SsoComponent,
    TwoFactorAuthenticatorComponent,
    TwoFactorComponent,
    TwoFactorDuoComponent,
    TwoFactorEmailComponent,
    TwoFactorOptionsComponent,
    TwoFactorRecoveryComponent,
    TwoFactorSetupComponent,
    TwoFactorVerifyComponent,
    TwoFactorWebAuthnComponent,
    TwoFactorYubiKeyComponent,
    UpdatePasswordComponent,
    UpdateTempPasswordComponent,
    VerifyEmailTokenComponent,
    VerifyRecoverDeleteComponent,
    VerifyRecoverDeleteProviderComponent,
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
    CollectionsComponent,
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
    EmergencyAddEditCipherComponent,
    FolderAddEditComponent,
    FrontendLayoutComponent,
    HintComponent,
    OrgAddEditComponent,
    OrganizationLayoutComponent,
    OrgAttachmentsComponent,
    OrgCollectionsComponent,
    OrgEventsComponent,
    OrgExposedPasswordsReportComponent,
    OrgInactiveTwoFactorReportComponent,
    OrgReusedPasswordsReportComponent,
    OrgUnsecuredWebsitesReportComponent,
    OrgUserConfirmComponent,
    OrgWeakPasswordsReportComponent,
    GeneratorComponent,
    PasswordGeneratorHistoryComponent,
    PreferencesComponent,
    PremiumBadgeComponent,
    ProfileComponent,
    ChangeAvatarDialogComponent,
    ProvidersComponent,
    PurgeVaultComponent,
    RecoverDeleteComponent,
    RecoverTwoFactorComponent,
    RemovePasswordComponent,
    SecurityComponent,
    SecurityKeysComponent,
    SelectableAvatarComponent,
    SendAddEditComponent,
    SetPasswordComponent,
    ShareComponent,
    SponsoredFamiliesComponent,
    SponsoringOrgRowComponent,
    SsoComponent,
    TwoFactorAuthenticatorComponent,
    TwoFactorComponent,
    TwoFactorDuoComponent,
    TwoFactorEmailComponent,
    TwoFactorOptionsComponent,
    TwoFactorRecoveryComponent,
    TwoFactorSetupComponent,
    TwoFactorVerifyComponent,
    TwoFactorWebAuthnComponent,
    TwoFactorYubiKeyComponent,
    UpdatePasswordComponent,
    UpdateTempPasswordComponent,
    UserLayoutComponent,
    VerifyEmailTokenComponent,
    VerifyRecoverDeleteComponent,
    VerifyRecoverDeleteProviderComponent,
    HeaderModule,
    DangerZoneComponent,
  ],
})
export class LooseComponentsModule {}
