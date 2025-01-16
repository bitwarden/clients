import { NgModule } from "@angular/core";

import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared";

import { LoginDecryptionOptionsComponentV1 } from "./login-decryption-options/login-decryption-options-v1.component";
import { LoginComponentV1 } from "./login-v1.component";
import { LoginViaAuthRequestComponentV1 } from "./login-via-auth-request-v1.component";
import { LoginViaWebAuthnComponent } from "./login-via-webauthn/login-via-webauthn.component";

@NgModule({
  imports: [SharedModule, CheckboxModule],
  declarations: [
    LoginComponentV1,
    LoginViaAuthRequestComponentV1,
    LoginDecryptionOptionsComponentV1,
    LoginViaWebAuthnComponent,
  ],
  exports: [
    LoginComponentV1,
    LoginViaAuthRequestComponentV1,
    LoginDecryptionOptionsComponentV1,
    LoginViaWebAuthnComponent,
  ],
})
export class LoginModule {}
