import { NgModule } from "@angular/core";

import { AcceptOrganizationInviteModule } from "./organization-invite/accept-organization.module";
import { AuthSettingsModule } from "./settings/settings.module";

@NgModule({
  imports: [AuthSettingsModule, AcceptOrganizationInviteModule],
  declarations: [],
  providers: [],
  exports: [AuthSettingsModule],
})
export class AuthModule {}
