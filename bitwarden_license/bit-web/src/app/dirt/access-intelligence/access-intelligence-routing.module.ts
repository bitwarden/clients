import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { RiskInsightsComponent } from "./risk-insights.component";

const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "risk-insights" },
  {
    path: "risk-insights",
    canActivate: [
      organizationPermissionsGuard((org) => org.useRiskInsights && org.canAccessReports),
    ],
    component: RiskInsightsComponent,
    data: {
      titleId: "RiskInsights",
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessIntelligenceRoutingModule {}
