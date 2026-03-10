import "zone.js";

// Register the locales for the application
import "../platform/app/locales";

import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CalloutModule, DialogModule } from "@bitwarden/components";
import { AssignCollectionsComponent } from "@bitwarden/vault";

import { DeleteAccountComponent } from "../auth/delete-account.component";
import { LoginModule } from "../auth/login/login.module";
import { SshAgentService } from "../autofill/services/ssh-agent.service";
import { PremiumComponent } from "../billing/app/accounts/premium.component";
import { DesktopPremiumUpgradePromptService } from "../services/desktop-premium-upgrade-prompt.service";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { UserVerificationComponent } from "./components/user-verification.component";
import { AccountSwitcherComponent } from "./layout/account-switcher.component";
import { HeaderComponent } from "./layout/header.component";
import { SearchComponent } from "./layout/search/search.component";
import { SharedModule } from "./shared/shared.module";

@NgModule({
  imports: [
    BrowserAnimationsModule,
    SharedModule,
    AppRoutingModule,
    LoginModule,
    DialogModule,
    CalloutModule,
    DeleteAccountComponent,
    UserVerificationComponent,
    AssignCollectionsComponent,
    JslibModule,
  ],
  declarations: [
    AccountSwitcherComponent,
    AppComponent,
    HeaderComponent,
    PremiumComponent,
    SearchComponent,
  ],
  providers: [
    SshAgentService,
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
