import "zone.js";

// Register the locales for the application
import "@bitwarden/desktop/platform/app/locales";

import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { CalloutModule, DialogModule } from "@bitwarden/components";
import { AppRoutingModule as OssAppRoutingModule } from "@bitwarden/desktop/app/app-routing.module";
import { UserVerificationComponent } from "@bitwarden/desktop/app/components/user-verification.component";
import { AccountSwitcherComponent } from "@bitwarden/desktop/app/layout/account-switcher.component";
import { HeaderComponent } from "@bitwarden/desktop/app/layout/header.component";
import { NavComponent } from "@bitwarden/desktop/app/layout/nav.component";
import { SearchComponent } from "@bitwarden/desktop/app/layout/search/search.component";
import { SharedModule } from "@bitwarden/desktop/app/shared/shared.module";
import { DeleteAccountComponent } from "@bitwarden/desktop/auth/delete-account.component";
import { LoginModule } from "@bitwarden/desktop/auth/login/login.module";
import { SshAgentService } from "@bitwarden/desktop/autofill/services/ssh-agent.service";
import { PremiumComponent } from "@bitwarden/desktop/billing/app/accounts/premium.component";
import { VaultFilterModule } from "@bitwarden/desktop/vault/app/vault/vault-filter/vault-filter.module";
import { VaultV2Component } from "@bitwarden/desktop/vault/app/vault/vault-v2.component";
import { AssignCollectionsComponent } from "@bitwarden/vault";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";

@NgModule({
  imports: [
    BrowserAnimationsModule,
    SharedModule,
    OssAppRoutingModule,
    AppRoutingModule,
    VaultFilterModule,
    LoginModule,
    DialogModule,
    CalloutModule,
    DeleteAccountComponent,
    UserVerificationComponent,
    NavComponent,
    AssignCollectionsComponent,
    VaultV2Component,
  ],
  declarations: [
    AccountSwitcherComponent,
    AppComponent,
    ColorPasswordPipe,
    ColorPasswordCountPipe,
    HeaderComponent,
    PremiumComponent,
    SearchComponent,
  ],
  providers: [SshAgentService],
  bootstrap: [AppComponent],
})
export class AppModule {}
