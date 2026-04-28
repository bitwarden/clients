import { NgModule } from "@angular/core";

import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

import { SsoManageComponent } from "../../auth/sso/sso-manage.component";

import { DomainAddEditDialogComponent } from "./manage/domain-verification/domain-add-edit-dialog/domain-add-edit-dialog.component";
import { DomainVerificationComponent } from "./manage/domain-verification/domain-verification.component";
import { ScimV2Component } from "./manage/scim-v2.component";
import { ScimComponent } from "./manage/scim.component";
import { OrganizationsRoutingModule } from "./organizations-routing.module";

@NgModule({
  imports: [SharedModule, OrganizationsRoutingModule, HeaderModule, ScimV2Component],
  declarations: [
    SsoManageComponent,
    ScimComponent,
    DomainVerificationComponent,
    DomainAddEditDialogComponent,
  ],
})
export class OrganizationsModule {}
