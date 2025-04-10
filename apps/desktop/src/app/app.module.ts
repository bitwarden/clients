import "zone.js";

// Register the locales for the application
import "../platform/app/locales";

import { NgModule } from "@angular/core";

import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { CalloutModule, DialogModule } from "@bitwarden/components";
import { DecryptionFailureDialogComponent } from "@bitwarden/vault";

import { AccessibilityCookieComponent } from "../auth/accessibility-cookie.component";
import { DeleteAccountComponent } from "../auth/delete-account.component";
import { LoginModule } from "../auth/login/login.module";
import { RemovePasswordComponent } from "../auth/remove-password.component";
import { SetPasswordComponent } from "../auth/set-password.component";
import { UpdateTempPasswordComponent } from "../auth/update-temp-password.component";
import { SshAgentService } from "../autofill/services/ssh-agent.service";
import { PremiumComponent } from "../billing/app/accounts/premium.component";
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
import { UserVerificationComponent } from "./components/user-verification.component";
import { AccountSwitcherComponent } from "./layout/account-switcher.component";
import { HeaderComponent } from "./layout/header.component";
import { NavComponent } from "./layout/nav.component";
import { SearchComponent } from "./layout/search/search.component";
import { SharedModule } from "./shared/shared.module";

@NgModule({
  imports: [
    SharedModule,
    AppRoutingModule,
    VaultFilterModule,
    LoginModule,
    DialogModule,
    CalloutModule,
    DeleteAccountComponent,
    UserVerificationComponent,
    DecryptionFailureDialogComponent,
    NavComponent,
  ],
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
    FolderAddEditComponent,
    HeaderComponent,
    PasswordHistoryComponent,
    PremiumComponent,
    RemovePasswordComponent,
    SearchComponent,
    SetPasswordComponent,
    SettingsComponent,
    ShareComponent,
    UpdateTempPasswordComponent,
    VaultComponent,
    VaultTimeoutInputComponent,
    ViewComponent,
    ViewCustomFieldsComponent,
  ],
  providers: [SshAgentService],
  bootstrap: [AppComponent],
})
export class AppModule {}
