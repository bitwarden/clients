import "zone.js";

// Register the locales for the application
import "../platform/app/locales";

import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { CalloutModule, DialogModule } from "@bitwarden/components";
import { AssignCollectionsComponent } from "@bitwarden/vault";

import { DeleteAccountComponent } from "../auth/delete-account.component";
import { LoginModule } from "../auth/login/login.module";
import { SshAgentService } from "../autofill/services/ssh-agent.service";
import { PremiumComponent } from "../billing/app/accounts/premium.component";
import { RemovePasswordComponent } from "../key-management/key-connector/remove-password.component";
import { VaultFilterModule } from "../vault/app/vault/vault-filter/vault-filter.module";
import { VaultV2Component } from "../vault/app/vault/vault-v2.component";

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
    BrowserAnimationsModule,

    SharedModule,
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
    RemovePasswordComponent,
    SearchComponent,
  ],
  providers: [SshAgentService],
  bootstrap: [AppComponent],
})
export class AppModule {}
