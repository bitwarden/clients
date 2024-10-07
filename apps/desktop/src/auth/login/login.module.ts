import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";

import { SharedModule } from "../../app/shared/shared.module";

import { LoginDecryptionOptionsComponent } from "./login-decryption-options/login-decryption-options.component";
import { LoginComponentV1 } from "./login-v1.component";
import { LoginViaAuthRequestComponent } from "./login-via-auth-request.component";

@NgModule({
  imports: [SharedModule, RouterModule],
  declarations: [
    LoginComponentV1,
    LoginViaAuthRequestComponent,
    EnvironmentSelectorComponent,
    LoginDecryptionOptionsComponent,
  ],
  exports: [LoginComponentV1, LoginViaAuthRequestComponent],
})
export class LoginModule {}
