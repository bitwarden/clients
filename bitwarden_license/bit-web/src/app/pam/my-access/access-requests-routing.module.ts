import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AccessNameResolverService } from "./access-name-resolver.service";
import { AccessRequestRouteComponent } from "./access-request-route/access-request-route.component";
import { AccessRequestsComponent } from "./access-requests.component";
import { ApprovalsTabComponent } from "./approvals-tab.component";
import { HistoryTabComponent } from "./history-tab.component";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const routes: Routes = [
  {
    path: "",
    component: AccessRequestsComponent,
    // Provided on the shell route so the shell and every tab share one loaded MyAccessService
    // instance (routed children inherit a parent route's providers, not a component's).
    providers: [AccessNameResolverService, MyAccessService],
    children: [
      { path: "", pathMatch: "full", redirectTo: "my-requests" },
      {
        path: "approvals",
        component: ApprovalsTabComponent,
        data: { titleId: "pamTabApprovals" },
      },
      {
        path: "my-requests",
        component: MyRequestsTabComponent,
        data: { titleId: "pamTabMyRequests" },
      },
      {
        path: "history",
        component: HistoryTabComponent,
        data: { titleId: "pamTabHistory" },
      },
    ],
  },
  {
    // A shareable link to a single one of the caller's own requests/leases — every row links here.
    // A sibling of the tabbed shell so it renders full-page; `AccessRequestRouteComponent` provides
    // its own page-scoped detail service, sharing only `AccessNameResolverService` via this route.
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
export class AccessRequestsRoutingModule {}
