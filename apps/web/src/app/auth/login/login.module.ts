import { NgModule } from "@angular/core";

import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared";

import { LoginDecryptionOptionsComponent } from "./login-decryption-options/login-decryption-options.component";
import { LoginWithDeviceComponent } from "./login-with-device.component";
import { LoginComponent } from "./login.component";

@NgModule({
  imports: [SharedModule, CheckboxModule],
  declarations: [LoginComponent, LoginWithDeviceComponent, LoginDecryptionOptionsComponent],
  exports: [LoginComponent, LoginWithDeviceComponent, LoginDecryptionOptionsComponent],
})
export class LoginModule {}
