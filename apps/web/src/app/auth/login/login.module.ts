import { NgModule } from "@angular/core";

import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared";

import { LoginDecryptionOptionsComponentV1 } from "./login-decryption-options/login-decryption-options-v1.component";
import { LoginViaWebAuthnComponent } from "./login-via-webauthn/login-via-webauthn.component";

@NgModule({
  imports: [SharedModule, CheckboxModule],
  declarations: [LoginDecryptionOptionsComponentV1, LoginViaWebAuthnComponent],
  exports: [LoginDecryptionOptionsComponentV1, LoginViaWebAuthnComponent],
})
export class LoginModule {}
