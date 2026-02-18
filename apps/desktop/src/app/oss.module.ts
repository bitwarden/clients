import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { ColorPasswordCountPipe } from "@bitwarden/angular/pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "@bitwarden/angular/pipes/color-password.pipe";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CalloutModule, DialogModule } from "@bitwarden/components";
import { AssignCollectionsComponent } from "@bitwarden/vault";

import { DeleteAccountComponent } from "../auth/delete-account.component";
import { LoginModule } from "../auth/login/login.module";
import { SshAgentService } from "../autofill/services/ssh-agent.service";
import { PremiumComponent } from "../billing/app/accounts/premium.component";
import { DesktopPremiumUpgradePromptService } from "../services/desktop-premium-upgrade-prompt.service";
import { VaultFilterModule } from "../vault/app/vault/vault-filter/vault-filter.module";
import { VaultV2Component } from "../vault/app/vault/vault-v2.component";

import { UserVerificationComponent } from "./components/user-verification.component";
import { AccountSwitcherComponent } from "./layout/account-switcher.component";
import { HeaderComponent } from "./layout/header.component";
import { NavComponent } from "./layout/nav.component";
import { SearchComponent } from "./layout/search/search.component";
import { SharedModule } from "./shared/shared.module";

@NgModule({
  imports: [
    SharedModule,
    BrowserAnimationsModule,
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
    ColorPasswordPipe,
    ColorPasswordCountPipe,
    HeaderComponent,
    PremiumComponent,
    SearchComponent,
  ],
  exports: [
    SharedModule,
    AccountSwitcherComponent,
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
})
export class OssModule {}
