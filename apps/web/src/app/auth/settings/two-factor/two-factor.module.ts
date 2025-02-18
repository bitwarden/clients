import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, CalloutModule, ItemModule, LinkModule } from "@bitwarden/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { LooseComponentsModule } from "../../../shared/loose-components.module";
import { SharedModule } from "../../../shared/shared.module";
import { UserVerificationModule } from "../../shared/components/user-verification";

import { TwoFactorRecoveryComponent } from "./two-factor-recovery.component";
import { TwoFactorSetupAuthenticatorComponent } from "./two-factor-setup-authenticator.component";
import { TwoFactorSetupDuoComponent } from "./two-factor-setup-duo.component";
import { TwoFactorSetupEmailComponent } from "./two-factor-setup-email.component";
import { TwoFactorSetupWebAuthnComponent } from "./two-factor-setup-webauthn.component";
import { TwoFactorSetupYubiKeyComponent } from "./two-factor-setup-yubikey.component";

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    RouterModule,
    ItemModule,
    CalloutModule,
    ButtonModule,
    HeaderModule,
    UserVerificationModule,
    JslibModule,
    LinkModule,
    LooseComponentsModule,
  ],
  declarations: [
    TwoFactorRecoveryComponent,
    TwoFactorSetupAuthenticatorComponent,
    TwoFactorSetupDuoComponent,
    TwoFactorSetupEmailComponent,
    TwoFactorSetupWebAuthnComponent,
    TwoFactorSetupYubiKeyComponent,
  ],
  exports: [
    TwoFactorRecoveryComponent,
    TwoFactorSetupAuthenticatorComponent,
    TwoFactorSetupDuoComponent,
    TwoFactorSetupEmailComponent,
    TwoFactorSetupWebAuthnComponent,
    TwoFactorSetupYubiKeyComponent,
  ],
})
export class TwoFactorModule {}
