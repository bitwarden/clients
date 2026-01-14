import "zone.js";

// Register the locales for the application
import "@bitwarden/desktop/platform/app/locales";

import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { CalloutModule, DialogModule } from "@bitwarden/components";
import { AppRoutingModule as OssAppRoutingModule } from "@bitwarden/desktop/app/app-routing.module";
import { AppModule as OssModule } from "@bitwarden/desktop/app/app.module";
import { UserVerificationComponent } from "@bitwarden/desktop/app/components/user-verification.component";
import { NavComponent } from "@bitwarden/desktop/app/layout/nav.component";
import { SharedModule } from "@bitwarden/desktop/app/shared/shared.module";
import { DeleteAccountComponent } from "@bitwarden/desktop/auth/delete-account.component";
import { LoginModule } from "@bitwarden/desktop/auth/login/login.module";
import { SshAgentService } from "@bitwarden/desktop/autofill/services/ssh-agent.service";
import { VaultFilterModule } from "@bitwarden/desktop/vault/app/vault/vault-filter/vault-filter.module";
import { VaultV2Component } from "@bitwarden/desktop/vault/app/vault/vault-v2.component";
import { AssignCollectionsComponent } from "@bitwarden/vault";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";

@NgModule({
  imports: [
    BrowserAnimationsModule,
    SharedModule,
    OssModule,
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
  declarations: [AppComponent],
  providers: [SshAgentService],
  bootstrap: [AppComponent],
})
export class AppModule {}
