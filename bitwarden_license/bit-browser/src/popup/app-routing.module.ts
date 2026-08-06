import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { RouteDataProperties } from "@bitwarden/browser/popup/app-routing.module";
import { TabsV2Component } from "@bitwarden/browser/popup/tabs-v2.component";

import { HealthComponent } from "./dirt/health/health.component";
import { canAccessHealth } from "./dirt/health/services/health-access.service";

/**
 * Routes for features that only ship with the commercial extension.
 *
 * The OSS routing module owns the `tabs` route, and route configs from separate modules are
 * flattened into the root config rather than merged, so commercial tabs are registered as their own
 * top-level route that re-uses {@link TabsV2Component} to render the same bottom navigation chrome.
 */
const routes: Routes = [
  {
    path: "tabs",
    component: TabsV2Component,
    data: { elevation: 0 } satisfies RouteDataProperties,
    children: [
      {
        path: "health",
        component: HealthComponent,
        canActivate: [authGuard, canAccessHealth],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
