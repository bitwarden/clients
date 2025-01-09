import { NgModule } from "@angular/core";

import { SharedModule } from "../../shared";

import { AcceptOrganizationComponent } from "./accept-organization.component";
import { AcceptOrganizationInviteService } from "./accept-organization.service";

@NgModule({
  declarations: [AcceptOrganizationComponent],
  imports: [SharedModule],
  providers: [AcceptOrganizationInviteService],
})
export class AcceptOrganizationInviteModule {}
