import "zone.js";

// Register the locales for the application
import "../platform/app/locales";

import { OverlayModule } from "@angular/cdk/overlay";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { IconModule } from "@bitwarden/components";

import { SshAgentService } from "../autofill/services/ssh-agent.service";
import { PremiumComponent } from "../billing/app/accounts/premium.component";
import { DesktopPremiumUpgradePromptService } from "../services/desktop-premium-upgrade-prompt.service";
import { MagnifyService } from "../vault/services/magnify.service";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { AvatarComponent } from "./components/avatar.component";
import { AccountSwitcherComponent } from "./layout/account-switcher.component";
import { HeaderComponent } from "./layout/header.component";
import { SearchComponent } from "./layout/search/search.component";
import { ServicesModule } from "./services/services.module";

/**
 * This is the `AppModule` for the Bitwarden desktop application.
 *
 * This file contains **ONLY** components that are used in `AppComponent`. You most likely
 * **DO NOT** want to modify this file. Routable components are handled by the `AppRoutingModule`.
 */
@NgModule({
  imports: [
    BrowserAnimationsModule,
    AppRoutingModule,
    JslibModule,
    IconModule,
    ReactiveFormsModule,
    OverlayModule,
    ServicesModule,
  ],
  declarations: [
    AvatarComponent,
    AccountSwitcherComponent,
    AppComponent,
    HeaderComponent,
    PremiumComponent,
    SearchComponent,
  ],
  providers: [
    SshAgentService,
    MagnifyService,
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
