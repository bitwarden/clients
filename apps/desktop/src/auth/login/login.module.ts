import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";

import { SharedModule } from "../../app/shared/shared.module";

import { LoginDecryptionOptionsComponentV1 } from "./login-decryption-options/login-decryption-options-v1.component";

@NgModule({
  imports: [SharedModule, RouterModule],
  declarations: [EnvironmentSelectorComponent, LoginDecryptionOptionsComponentV1],
  exports: [],
})
export class LoginModule {}
