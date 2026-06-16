import { NgModule } from "@angular/core";

import { AuthSettingsModule } from "./settings/settings.module";

@NgModule({
  imports: [AuthSettingsModule],
  declarations: [],
  providers: [],
  exports: [AuthSettingsModule],
})
export class AuthModule {}
