import { NgModule } from "@angular/core";

import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared";

import { LoginViaWebAuthnComponent } from "./login-via-webauthn/login-via-webauthn.component";

@NgModule({
  imports: [SharedModule, CheckboxModule],
  declarations: [LoginViaWebAuthnComponent],
  exports: [LoginViaWebAuthnComponent],
})
export class LoginModule {}
