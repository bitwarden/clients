import { Routes } from "@angular/router";

import { MyAccessRequestsListComponent } from "../my-access-requests/my-access-requests-list.component";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApprovalsTabComponent } from "./approvals-tab.component";
import { ApproverInboxComponent } from "./approver-inbox.component";
import { ApproverInboxService } from "./approver-inbox.service";
import { AuditLogTabComponent } from "./audit-log-tab.component";

/**
 * Routable Access-requests tabs, shared by both mounts (end-user OSS routing and the Admin Console
 * PamRoutingModule). The shell ({@link ApproverInboxComponent}) renders the tab nav + outlet and
 * stays mounted across tab navigation; each tab is a child route. The two page-scoped services are
 * provided here on the shell route so the shell and every tab share one loaded instance — routed
 * children do not inherit a host component's element-injector providers.
 */
export const approverInboxRoutes: Routes = [
  {
    path: "",
    component: ApproverInboxComponent,
    providers: [ApproverInboxService, MyAccessRequestsService],
    children: [
      { path: "", pathMatch: "full", redirectTo: "approvals" },
      {
        path: "approvals",
        component: ApprovalsTabComponent,
        data: { titleId: "pamTabApprovals" },
      },
      {
        path: "my-requests",
        component: MyAccessRequestsListComponent,
        data: { titleId: "pamTabMyRequests" },
      },
      {
        path: "audit-log",
        component: AuditLogTabComponent,
        data: { titleId: "pamTabAuditLog" },
      },
    ],
  },
];
