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
    // On the shell route so every tab shares one instance; routed children inherit a parent
    // route's providers, not a component's.
    providers: [AccessNameResolverService, MyAccessService, ApproverInboxService],
    children: [
      { path: "", pathMatch: "full", redirectTo: "my-requests" },
      {
        path: "approvals",
        component: ApprovalsTabComponent,
        // Redirects a non-approver to My requests, since their tab bar hides Approvals.
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
        // A shareable link to one request; a shell child so the header and tab bar stay mounted
        // underneath.
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
