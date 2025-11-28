import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { LayoutModule } from "@angular/cdk/layout";
import { OverlayModule } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import {
  DialogModule,
  AvatarModule,
  ButtonModule,
  FormFieldModule,
  ToastModule,
  CalloutModule,
  LinkModule,
} from "@bitwarden/components";

import { AccountComponent } from "../auth/popup/account-switching/account.component";
import { CurrentAccountComponent } from "../auth/popup/account-switching/current-account.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { RemovePasswordComponent } from "../key-management/key-connector/remove-password.component";
import { PopOutComponent } from "../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../platform/popup/layout/popup-page.component";
import { PopupTabNavigationComponent } from "../platform/popup/layout/popup-tab-navigation.component";
import { FilePopoutCalloutComponent } from "../tools/popup/components/file-popout-callout.component";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ExtensionAnonLayoutWrapperComponent } from "./components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
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
    UserVerificationDialogComponent,
    CurrentAccountComponent,
    FormFieldModule,
    ExtensionAnonLayoutWrapperComponent,
    CalloutModule,
    LinkModule,
  ],
  declarations: [
    AppComponent,
    ColorPasswordPipe,
    ColorPasswordCountPipe,
    TabsV2Component,
    RemovePasswordComponent,
  ],
  exports: [CalloutModule],
  providers: [CurrencyPipe, DatePipe],
  bootstrap: [AppComponent],
})
export class AppModule {}
