import { NgModule } from "@angular/core";

import { PasswordCalloutComponent } from "@bitwarden/auth/angular";

import { UserKeyRotationModule } from "../../key-management/key-rotation/user-key-rotation.module";
import { SharedModule } from "../../shared";
import { EmergencyAccessModule } from "../emergency-access";

import { WebauthnLoginSettingsModule } from "./webauthn-login-settings";

@NgModule({
  imports: [
    SharedModule,
    WebauthnLoginSettingsModule,
    EmergencyAccessModule,
    PasswordCalloutComponent,
    UserKeyRotationModule,
  ],
  declarations: [],
  providers: [],
  exports: [],
})
export class AuthSettingsModule {}
