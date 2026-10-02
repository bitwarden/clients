import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

/**
 * Routes for features that only ship with the commercial extension.
 *
 * The OSS routing module owns the `tabs` route, and route configs from separate modules are
 * flattened into the root config rather than merged, so commercial tabs are registered as their own
 * top-level route that re-uses {@link TabsV2Component} to render the same bottom navigation chrome.
 */
const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
