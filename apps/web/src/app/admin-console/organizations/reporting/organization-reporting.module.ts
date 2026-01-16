import { NgModule } from "@angular/core";

import { ReportsSharedModule } from "../../../dirt/reports";
import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";

import { OrganizationReportingRoutingModule } from "./organization-reporting-routing.module";
import { ReportsHomeComponent } from "./reports-home.component";
import { RiskInsightsPrototypeComponent } from "./risk-insights-prototype/risk-insights-prototype.component";

@NgModule({
  imports: [
    SharedModule,
    ReportsSharedModule,
    OrganizationReportingRoutingModule,
    HeaderModule,
    RiskInsightsPrototypeComponent,
  ],
  declarations: [ReportsHomeComponent],
})
export class OrganizationReportingModule {}
