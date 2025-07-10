import { NgModule } from "@angular/core";

import { ReportsSharedModule } from "../../../dirt/reports";
import { LooseComponentsModule } from "../../../shared";
import { SharedModule } from "../../../shared/shared.module";

import { OrganizationReportingRoutingModule } from "./organization-reporting-routing.module";
import { ReportsHomeComponent } from "./reports-home.component";

@NgModule({
  imports: [
    SharedModule,
    ReportsSharedModule,
    OrganizationReportingRoutingModule,
    LooseComponentsModule,
  ],
  declarations: [ReportsHomeComponent],
})
export class OrganizationReportingModule {}
