import { NgModule } from "@angular/core";

import { PasswordCalloutComponent } from "@bitwarden/auth/angular";

import { SharedModule } from "../../shared";
import { EmergencyAccessModule } from "../emergency-access";

import { WebauthnLoginSettingsModule } from "./webauthn-login-settings";

@NgModule({
  imports: [
    SharedModule,
    WebauthnLoginSettingsModule,
    EmergencyAccessModule,
    PasswordCalloutComponent,
  ],
  declarations: [],
  providers: [],
  exports: [],
})
export class AuthSettingsModule {}
