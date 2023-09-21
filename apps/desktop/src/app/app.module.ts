import "zone.js";

// Register the locales for the application
import "../platform/app/locales";

import { DialogModule } from "@angular/cdk/dialog";
import { NgModule } from "@angular/core";

import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";

import { AccessibilityCookieComponent } from "../auth/accessibility-cookie.component";
import { DeleteAccountComponent } from "../auth/delete-account.component";
import { EnvironmentComponent } from "../auth/environment.component";
import { HintComponent } from "../auth/hint.component";
import { LockComponent } from "../auth/lock.component";
import { LoginApprovalComponent } from "../auth/login/login-approval.component";
import { LoginModule } from "../auth/login/login.module";
import { RegisterComponent } from "../auth/register.component";
import { RemovePasswordComponent } from "../auth/remove-password.component";
import { SetPasswordComponent } from "../auth/set-password.component";
import { SsoComponent } from "../auth/sso.component";
import { TwoFactorOptionsComponent } from "../auth/two-factor-options.component";
import { TwoFactorComponent } from "../auth/two-factor.component";
import { UpdateTempPasswordComponent } from "../auth/update-temp-password.component";
import { PremiumComponent } from "../vault/app/accounts/premium.component";
import { PasswordRepromptComponent } from "../vault/app/components/password-reprompt.component";
import { AddEditCustomFieldsComponent } from "../vault/app/vault/add-edit-custom-fields.component";
import { AddEditComponent } from "../vault/app/vault/add-edit.component";
import { AttachmentsComponent } from "../vault/app/vault/attachments.component";
import { CollectionsComponent } from "../vault/app/vault/collections.component";
import { FolderAddEditComponent } from "../vault/app/vault/folder-add-edit.component";
import { PasswordHistoryComponent } from "../vault/app/vault/password-history.component";
import { ShareComponent } from "../vault/app/vault/share.component";
import { VaultFilterModule } from "../vault/app/vault/vault-filter/vault-filter.module";
import { VaultItemsComponent } from "../vault/app/vault/vault-items.component";
import { VaultComponent } from "../vault/app/vault/vault.component";
import { ViewCustomFieldsComponent } from "../vault/app/vault/view-custom-fields.component";
import { ViewComponent } from "../vault/app/vault/view.component";

import { SettingsComponent } from "./accounts/settings.component";
import { VaultTimeoutInputComponent } from "./accounts/vault-timeout-input.component";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { SetPinComponent } from "./components/set-pin.component";
import { UserVerificationComponent } from "./components/user-verification.component";
import { AccountSwitcherComponent } from "./layout/account-switcher.component";
import { HeaderComponent } from "./layout/header.component";
import { NavComponent } from "./layout/nav.component";
import { SearchComponent } from "./layout/search/search.component";
import { SharedModule } from "./shared/shared.module";
import { ExportComponent } from "./tools/export/export.component";
import { GeneratorComponent } from "./tools/generator.component";
import { PasswordGeneratorHistoryComponent } from "./tools/password-generator-history.component";
import { AddEditComponent as SendAddEditComponent } from "./tools/send/add-edit.component";
import { SendComponent } from "./tools/send/send.component";

@NgModule({
  imports: [SharedModule, DialogModule, AppRoutingModule, VaultFilterModule, LoginModule],
  declarations: [
    AccessibilityCookieComponent,
    AccountSwitcherComponent,
    AddEditComponent,
    AddEditCustomFieldsComponent,
    AppComponent,
    AttachmentsComponent,
    VaultItemsComponent,
    CollectionsComponent,
    ColorPasswordPipe,
    ColorPasswordCountPipe,
    DeleteAccountComponent,
    EnvironmentComponent,
    ExportComponent,
    FolderAddEditComponent,
    HeaderComponent,
    HintComponent,
    LockComponent,
    NavComponent,
    GeneratorComponent,
    PasswordGeneratorHistoryComponent,
    PasswordHistoryComponent,
    PasswordRepromptComponent,
    PremiumComponent,
    RegisterComponent,
    RemovePasswordComponent,
    SearchComponent,
    SendAddEditComponent,
    SendComponent,
    SetPasswordComponent,
    SetPinComponent,
    SettingsComponent,
    ShareComponent,
    SsoComponent,
    TwoFactorComponent,
    TwoFactorOptionsComponent,
    UpdateTempPasswordComponent,
    UserVerificationComponent,
    VaultComponent,
    VaultTimeoutInputComponent,
    ViewComponent,
    ViewCustomFieldsComponent,
    LoginApprovalComponent,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
