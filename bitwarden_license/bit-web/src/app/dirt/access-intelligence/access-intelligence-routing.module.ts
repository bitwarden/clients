import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { RiskInsightsComponent } from "./risk-insights.component";

const routes: Routes = [
  {
    path: "",
    // TODO: Update useRiskInsights property name to useAccessIntelligence after backend API update
    canActivate: [
      organizationPermissionsGuard((org) => org.useRiskInsights && org.canAccessReports),
    ],
    component: RiskInsightsComponent,
    data: {
      titleId: "accessIntelligence",
    },
  },
  {
    path: "risk-insights",
    redirectTo: "",
    pathMatch: "full",
    // Backwards compatibility: redirect old "risk-insights" route to new base route
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessIntelligenceRoutingModule {}
