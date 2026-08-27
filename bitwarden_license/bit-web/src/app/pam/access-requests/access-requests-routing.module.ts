import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { canViewApprovalsGuard } from "../approvals/can-view-approvals.guard";

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
    // Provided on the shell route so the shell and every tab share one loaded instance of each
    // (routed children inherit a parent route's providers, not a component's).
    providers: [AccessNameResolverService, MyAccessService, ApproverInboxService],
    children: [
      { path: "", pathMatch: "full", redirectTo: "my-requests" },
      {
        path: "approvals",
        component: ApprovalsTabComponent,
        // A non-approver is redirected to My requests rather than shown a tab that is hidden from
        // their own tab bar; see the guard.
        canActivate: [canViewApprovalsGuard],
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
      {
        // A shareable link to a single one of the caller's own requests/leases — every row links
        // here, and it is the URL the planned approval deep link lands on. A child of the shell
        // rather than a sibling so the header and tab bar stay mounted underneath: the detail
        // renders as a dialog over them, and the host owns the navigation that closing it needs.
        path: "requests/:id",
        component: AccessRequestRouteComponent,
        data: { titleId: "pamAccessRequestTitle" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessRequestsRoutingModule {}
