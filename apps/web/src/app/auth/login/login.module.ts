import { NgModule } from "@angular/core";

import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared";

import { LoginDecryptionOptionsComponent } from "./login-decryption-options/login-decryption-options.component";
import { LoginComponentV1 } from "./login-v1.component";
import { LoginViaAuthRequestComponent } from "./login-via-auth-request.component";
import { LoginViaWebAuthnComponent } from "./login-via-webauthn/login-via-webauthn.component";

@NgModule({
  imports: [SharedModule, CheckboxModule],
  declarations: [
    LoginComponentV1,
    LoginViaAuthRequestComponent,
    LoginDecryptionOptionsComponent,
    LoginViaWebAuthnComponent,
  ],
  exports: [
    LoginComponentV1,
    LoginViaAuthRequestComponent,
    LoginDecryptionOptionsComponent,
    LoginViaWebAuthnComponent,
  ],
})
export class LoginModule {}
