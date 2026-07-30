import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AccessNameResolverService } from "./access-name-resolver.service";
import { AccessRequestRouteComponent } from "./access-request-route/access-request-route.component";
import { MyAccessComponent } from "./my-access.component";
import { MyAccessService } from "./my-access.service";

const routes: Routes = [
  {
    path: "",
    component: MyAccessComponent,
    providers: [AccessNameResolverService, MyAccessService],
    data: { titleId: "pamMyAccess" },
  },
  {
    // A shareable link to a single one of the caller's own requests/leases — every row in the
    // list above links here. `AccessRequestRouteComponent` provides its own page-scoped
    // `AccessRequestDetailService`; only `AccessNameResolverService` is shared via this route.
    path: "requests/:id",
    component: AccessRequestRouteComponent,
    providers: [AccessNameResolverService],
    data: { titleId: "pamAccessRequestTitle" },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MyAccessRoutingModule {}
