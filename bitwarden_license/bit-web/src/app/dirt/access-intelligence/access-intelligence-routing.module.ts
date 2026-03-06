import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessAccessIntelligence } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { RiskInsightsComponent } from "./risk-insights.component";
import { AccessIntelligencePageComponent } from "./v2/access-intelligence-page/access-intelligence-page.component";

const routes: Routes = [
  // Feature-flagged routing: V1 (default) vs V2 (when flag is ON)
  ...featureFlaggedRoute({
    defaultComponent: RiskInsightsComponent, // V1
    flaggedComponent: AccessIntelligencePageComponent, // V2
    featureFlag: FeatureFlag.AccessIntelligenceNewArchitecture,
    routeOptions: {
      path: "",
      canActivate: [organizationPermissionsGuard(canAccessAccessIntelligence)],
      data: { titleId: "accessIntelligence" },
    },
  }),
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
