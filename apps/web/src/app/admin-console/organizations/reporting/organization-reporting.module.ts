import { NgModule } from "@angular/core";

import { ReportsSharedModule } from "../../../dirt/reports";
import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";

import { OrganizationReportingRoutingModule } from "./organization-reporting-routing.module";
import { ReportsHomeComponent } from "./reports-home.component";

@NgModule({
  imports: [SharedModule, ReportsSharedModule, OrganizationReportingRoutingModule, HeaderModule],
  declarations: [ReportsHomeComponent],
})
export class OrganizationReportingModule {}
