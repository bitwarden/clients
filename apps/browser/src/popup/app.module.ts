import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { LayoutModule } from "@angular/cdk/layout";
import { OverlayModule, OVERLAY_DEFAULT_CONFIG } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  DefaultVaultHealthReportService,
  VaultHealthReportService,
} from "@bitwarden/common/dirt/vault-health/services";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import {
  DialogModule,
  AvatarModule,
  ButtonModule,
  FormFieldModule,
  ToastModule,
  CalloutModule,
  LinkModule,
} from "@bitwarden/components";
import { KEEPER_SSO_TAB_MONITOR } from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

import { AccountComponent } from "../auth/popup/account-switching/account.component";
import { CurrentAccountComponent } from "../auth/popup/account-switching/current-account.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PopOutComponent } from "../platform/popup/components/pop-out.component";
import { PopupFocusWrapDirective } from "../platform/popup/components/popup-focus-wrap.directive";
import { PopupFooterComponent } from "../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../platform/popup/layout/popup-page.component";
import { PopupTabNavigationComponent } from "../platform/popup/layout/popup-tab-navigation.component";
import { BrowserKeeperSsoTabMonitor } from "../tools/popup/settings/import/browser-keeper-sso-tab-monitor";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ExtensionAnonLayoutWrapperComponent } from "./components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
import { healthNavButton$ } from "./dirt/health/health-nav-button";
import { HealthAccessService } from "./dirt/health/services/health-access.service";
import { HEALTH_TAB_NAV_BUTTON } from "./health-tab-nav-button";
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
    AvatarModule,
    AccountComponent,
    ButtonModule,
    NotificationsSettingsComponent,
    PopOutComponent,
    PopupFocusWrapDirective,
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
  declarations: [AppComponent, TabsV2Component],
  exports: [CalloutModule],
  providers: [
    CurrencyPipe,
    DatePipe,
    { provide: KEEPER_SSO_TAB_MONITOR, useClass: BrowserKeeperSsoTabMonitor },
    { provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } },
    safeProvider({
      provide: VaultHealthReportService,
      useClass: DefaultVaultHealthReportService,
      deps: [CipherRiskService, LogService],
    }),
    safeProvider({
      provide: HEALTH_TAB_NAV_BUTTON,
      useFactory: healthNavButton$,
      deps: [AccountService, HealthAccessService],
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
