import { NgModule } from "@angular/core";

import { OrganizationReportingRoutingModule } from "./organization-reporting-routing.module";
import { ReportsHomeComponent } from "./reports-home.component";

@NgModule({
  imports: [OrganizationReportingRoutingModule, ReportsHomeComponent],
})
export class OrganizationReportingModule {}
