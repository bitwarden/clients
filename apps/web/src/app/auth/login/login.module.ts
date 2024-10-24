import { NgModule } from "@angular/core";

import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared";

import { LoginDecryptionOptionsComponent } from "./login-decryption-options/login-decryption-options.component";
import { LoginViaAuthRequestComponentV1 } from "./login-via-auth-request-v1.component";
import { LoginViaWebAuthnComponent } from "./login-via-webauthn/login-via-webauthn.component";
import { LoginComponent } from "./login.component";

@NgModule({
  imports: [SharedModule, CheckboxModule],
  declarations: [
    LoginComponent,
    LoginViaAuthRequestComponentV1,
    LoginDecryptionOptionsComponent,
    LoginViaWebAuthnComponent,
  ],
  exports: [
    LoginComponent,
    LoginViaAuthRequestComponentV1,
    LoginDecryptionOptionsComponent,
    LoginViaWebAuthnComponent,
  ],
})
export class LoginModule {}
