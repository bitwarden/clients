import { NgModule } from "@angular/core";

import { LooseComponentsModule } from "../../../shared";
import { SharedModule } from "../../../shared/shared.module";
import { ReportsSharedModule } from "../../../tools/reports";

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
