import { NgModule, inject } from "@angular/core";
import { Router, RouterModule, Routes } from "@angular/router";

import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { canViewApprovalsGuard } from "../approvals/can-view-approvals.guard";

import { AccessNameResolverService } from "./access-name-resolver.service";
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
    ],
  },
  {
    // The email deep-link target. Kept as a redirect rather than a page so an existing link lands
    // on the list with the request's drawer open over it — a redirect FUNCTION, because the :id has
    // to cross from a path segment into a query param.
    path: "requests/:id",
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree(["/pam/my-requests"], {
        queryParams: { requestId: params.id },
      }),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessRequestsRoutingModule {}
