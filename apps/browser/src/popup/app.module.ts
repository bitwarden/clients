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
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { AvatarModule, ButtonModule, FormFieldModule, ToastModule } from "@bitwarden/components";

import { AccountComponent } from "../auth/popup/account-switching/account.component";
import { CurrentAccountComponent } from "../auth/popup/account-switching/current-account.component";
import { EnvironmentComponent } from "../auth/popup/environment.component";
import { ExtensionAnonLayoutWrapperComponent } from "../auth/popup/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
import { HintComponent } from "../auth/popup/hint.component";
import { HomeComponent } from "../auth/popup/home.component";
import { LoginDecryptionOptionsComponentV1 } from "../auth/popup/login-decryption-options/login-decryption-options-v1.component";
import { LoginComponentV1 } from "../auth/popup/login-v1.component";
import { LoginViaAuthRequestComponentV1 } from "../auth/popup/login-via-auth-request-v1.component";
import { RemovePasswordComponent } from "../auth/popup/remove-password.component";
import { SetPasswordComponent } from "../auth/popup/set-password.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { VaultTimeoutInputComponent } from "../auth/popup/settings/vault-timeout-input.component";
import { SsoComponentV1 } from "../auth/popup/sso-v1.component";
import { TwoFactorOptionsComponentV1 } from "../auth/popup/two-factor-options-v1.component";
import { TwoFactorComponentV1 } from "../auth/popup/two-factor-v1.component";
import { UpdateTempPasswordComponent } from "../auth/popup/update-temp-password.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PopOutComponent } from "../platform/popup/components/pop-out.component";
import { HeaderComponent } from "../platform/popup/header.component";
import { PopupFooterComponent } from "../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../platform/popup/layout/popup-page.component";
import { PopupTabNavigationComponent } from "../platform/popup/layout/popup-tab-navigation.component";
import { FilePopoutCalloutComponent } from "../tools/popup/components/file-popout-callout.component";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { UserVerificationComponent } from "./components/user-verification.component";
import { ServicesModule } from "./services/services.module";
import { TabsV2Component } from "./tabs-v2.component";

// Register the locales for the application
import "../platform/popup/locales";

@NgModule({
  imports: [
    A11yModule,
    AppRoutingModule,
    AutofillComponent,
    AccountSecurityComponent,
    ToastModule.forRoot({
      maxOpened: 2,
      autoDismiss: true,
      closeButton: true,
      positionClass: "toast-top-full-width",
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
    NotificationsSettingsComponent,
    PopOutComponent,
    PopupPageComponent,
    PopupTabNavigationComponent,
    PopupFooterComponent,
    PopupHeaderComponent,
    HeaderComponent,
    UserVerificationDialogComponent,
    CurrentAccountComponent,
    FormFieldModule,
    ExtensionAnonLayoutWrapperComponent,
  ],
  declarations: [
    AppComponent,
    ColorPasswordPipe,
    ColorPasswordCountPipe,
    EnvironmentComponent,
    HintComponent,
    HomeComponent,
    LoginViaAuthRequestComponentV1,
    LoginComponentV1,
    LoginDecryptionOptionsComponentV1,
    SetPasswordComponent,
    SsoComponentV1,
    TabsV2Component,
    TwoFactorComponentV1,
    TwoFactorOptionsComponentV1,
    UpdateTempPasswordComponent,
    UserVerificationComponent,
    VaultTimeoutInputComponent,
    RemovePasswordComponent,
    EnvironmentSelectorComponent,
  ],
  exports: [],
  providers: [CurrencyPipe, DatePipe],
  bootstrap: [AppComponent],
})
export class AppModule {}
