import { NgModule } from "@angular/core";

import { IconModule } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

import { SsoManageComponent } from "../../auth/sso/sso-manage.component";

import { ScimComponent } from "./manage/scim.component";
import { OrganizationsRoutingModule } from "./organizations-routing.module";

@NgModule({
  imports: [SharedModule, OrganizationsRoutingModule, HeaderModule, ScimComponent, IconModule],
  declarations: [SsoManageComponent],
})
export class OrganizationsModule {}
