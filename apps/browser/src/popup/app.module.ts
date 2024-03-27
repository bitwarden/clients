import { A11yModule } from "@angular/cdk/a11y";
import { DialogModule } from "@angular/cdk/dialog";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { LayoutModule } from "@angular/cdk/layout";
import { OverlayModule } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";
import { BitwardenToastModule } from "@bitwarden/angular/components/toastr.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { AvatarModule, ButtonModule } from "@bitwarden/components";
import { ExportScopeCalloutComponent } from "@bitwarden/vault-export-ui";

import { AccountSwitcherComponent } from "../auth/popup/account-switching/account-switcher.component";
import { AccountComponent } from "../auth/popup/account-switching/account.component";
import { CurrentAccountComponent } from "../auth/popup/account-switching/current-account.component";
import { EnvironmentComponent } from "../auth/popup/environment.component";
import { HintComponent } from "../auth/popup/hint.component";
import { HomeComponent } from "../auth/popup/home.component";
import { LockComponent } from "../auth/popup/lock.component";
import { LoginDecryptionOptionsComponent } from "../auth/popup/login-decryption-options/login-decryption-options.component";
import { LoginViaAuthRequestComponent } from "../auth/popup/login-via-auth-request.component";
import { LoginComponent } from "../auth/popup/login.component";
import { RegisterComponent } from "../auth/popup/register.component";
import { RemovePasswordComponent } from "../auth/popup/remove-password.component";
import { SetPasswordComponent } from "../auth/popup/set-password.component";
import { SsoComponent } from "../auth/popup/sso.component";
import { TwoFactorOptionsComponent } from "../auth/popup/two-factor-options.component";
import { TwoFactorComponent } from "../auth/popup/two-factor.component";
import { UpdateTempPasswordComponent } from "../auth/popup/update-temp-password.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { HeaderComponent } from "../platform/popup/header.component";
import { FilePopoutCalloutComponent } from "../tools/popup/components/file-popout-callout.component";
import { GeneratorComponent } from "../tools/popup/generator/generator.component";
import { PasswordGeneratorHistoryComponent } from "../tools/popup/generator/password-generator-history.component";
import { SendListComponent } from "../tools/popup/send/components/send-list.component";
import { SendAddEditComponent } from "../tools/popup/send/send-add-edit.component";
import { SendGroupingsComponent } from "../tools/popup/send/send-groupings.component";
import { SendTypeComponent } from "../tools/popup/send/send-type.component";
import { ExportComponent } from "../tools/popup/settings/export.component";
import { ActionButtonsComponent } from "../vault/popup/components/action-buttons.component";
import { CipherRowComponent } from "../vault/popup/components/cipher-row.component";
import { Fido2CipherRowComponent } from "../vault/popup/components/fido2/fido2-cipher-row.component";
import { Fido2UseBrowserLinkComponent } from "../vault/popup/components/fido2/fido2-use-browser-link.component";
import { Fido2Component } from "../vault/popup/components/fido2/fido2.component";
import { AddEditCustomFieldsComponent } from "../vault/popup/components/vault/add-edit-custom-fields.component";
import { AddEditComponent } from "../vault/popup/components/vault/add-edit.component";
import { AttachmentsComponent } from "../vault/popup/components/vault/attachments.component";
import { CollectionsComponent } from "../vault/popup/components/vault/collections.component";
import { CurrentTabComponent } from "../vault/popup/components/vault/current-tab.component";
import { PasswordHistoryComponent } from "../vault/popup/components/vault/password-history.component";
import { ShareComponent } from "../vault/popup/components/vault/share.component";
import { VaultFilterComponent } from "../vault/popup/components/vault/vault-filter.component";
import { VaultItemsComponent } from "../vault/popup/components/vault/vault-items.component";
import { VaultSelectComponent } from "../vault/popup/components/vault/vault-select.component";
import { ViewCustomFieldsComponent } from "../vault/popup/components/vault/view-custom-fields.component";
import { ViewComponent } from "../vault/popup/components/vault/view.component";
import { FolderAddEditComponent } from "../vault/popup/settings/folder-add-edit.component";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { PopOutComponent } from "./components/pop-out.component";
import { PrivateModeWarningComponent } from "./components/private-mode-warning.component";
import { UserVerificationComponent } from "./components/user-verification.component";
import { ServicesModule } from "./services/services.module";
import { ExcludedDomainsComponent } from "./settings/excluded-domains.component";
import { FoldersComponent } from "./settings/folders.component";
import { HelpAndFeedbackComponent } from "./settings/help-and-feedback.component";
import { OptionsComponent } from "./settings/options.component";
import { PremiumComponent } from "./settings/premium.component";
import { SettingsComponent } from "./settings/settings.component";
import { SyncComponent } from "./settings/sync.component";
import { VaultTimeoutInputComponent } from "./settings/vault-timeout-input.component";
import { TabsComponent } from "./tabs.component";

// Register the locales for the application
import "../platform/popup/locales";

@NgModule({
  imports: [
    A11yModule,
    AppRoutingModule,
    BitwardenToastModule.forRoot({
      maxOpened: 2,
      autoDismiss: true,
      closeButton: true,
      positionClass: "toast-bottom-full-width",
    }),
    BrowserAnimationsModule,
    BrowserModule,
    DragDropModule,
    FormsModule,
    JslibModule,
    LayoutModule,
    OverlayModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
    DialogModule,
    FilePopoutCalloutComponent,
    AvatarModule,
    AccountComponent,
    ButtonModule,
    ExportScopeCalloutComponent,
  ],
  declarations: [
    ActionButtonsComponent,
    AddEditComponent,
    AddEditCustomFieldsComponent,
    AppComponent,
    AttachmentsComponent,
    CipherRowComponent,
    VaultItemsComponent,
    CollectionsComponent,
    ColorPasswordPipe,
    ColorPasswordCountPipe,
    CurrentTabComponent,
    EnvironmentComponent,
    ExcludedDomainsComponent,
    ExportComponent,
    Fido2CipherRowComponent,
    Fido2UseBrowserLinkComponent,
    FolderAddEditComponent,
    FoldersComponent,
    VaultFilterComponent,
    HeaderComponent,
    HintComponent,
    HomeComponent,
    LockComponent,
    LoginComponent,
    LoginViaAuthRequestComponent,
    LoginDecryptionOptionsComponent,
    OptionsComponent,
    GeneratorComponent,
    PasswordGeneratorHistoryComponent,
    PasswordHistoryComponent,
    PopOutComponent,
    PremiumComponent,
    PrivateModeWarningComponent,
    RegisterComponent,
    SendAddEditComponent,
    SendGroupingsComponent,
    SendListComponent,
    SendTypeComponent,
    SetPasswordComponent,
    SettingsComponent,
    ShareComponent,
    SsoComponent,
    SyncComponent,
    TabsComponent,
    TwoFactorComponent,
    TwoFactorOptionsComponent,
    UpdateTempPasswordComponent,
    UserVerificationComponent,
    VaultTimeoutInputComponent,
    ViewComponent,
    ViewCustomFieldsComponent,
    RemovePasswordComponent,
    VaultSelectComponent,
    Fido2Component,
    HelpAndFeedbackComponent,
    AutofillComponent,
    EnvironmentSelectorComponent,
    CurrentAccountComponent,
    AccountSwitcherComponent,
  ],
  providers: [CurrencyPipe, DatePipe],
  bootstrap: [AppComponent],
})
export class AppModule {}
