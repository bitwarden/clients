import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, CalloutModule, ItemModule, LinkModule } from "@bitwarden/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";
import { UserVerificationModule } from "../../shared/components/user-verification";

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
  ],
  declarations: [
    TwoFactorSetupEmailComponent,
    TwoFactorSetupWebAuthnComponent,
    TwoFactorSetupYubiKeyComponent,
  ],
  exports: [
    TwoFactorSetupEmailComponent,
    TwoFactorSetupWebAuthnComponent,
    TwoFactorSetupYubiKeyComponent,
  ],
})
export class TwoFactorModule {}
