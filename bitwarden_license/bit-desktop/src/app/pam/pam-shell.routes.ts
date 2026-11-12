import { Routes } from "@angular/router";

import {
  AccessNameResolverService,
  ApproverInboxService,
  MyAccessService,
  canViewApprovalsGuard,
} from "@bitwarden/bit-pam-components";

import { PamShellComponent } from "./pam-shell.component";
import { PamRequestRouteComponent } from "./request/pam-request-route.component";
import { PamApprovalsTabComponent } from "./tabs/pam-approvals-tab.component";
import { PamHistoryTabComponent } from "./tabs/pam-history-tab.component";
import { PamMyRequestsTabComponent } from "./tabs/pam-my-requests-tab.component";

/** The routes mounted at `/pam`: the shell, with Approvals, My requests and History as tabs. */
export const PAM_SHELL_ROUTES: Routes = [
  {
    path: "",
    component: PamShellComponent,
    // On the shell route so every tab shares one instance; routed children inherit a parent
    // route's providers, not a component's.
    providers: [AccessNameResolverService, MyAccessService, ApproverInboxService],
    children: [
      // Approvals is the default; its guard sends a non-approver on to My requests.
      { path: "", pathMatch: "full", redirectTo: "approvals" },
      {
        path: "approvals",
        component: PamApprovalsTabComponent,
        // Redirects a non-approver to My requests, since their tab bar hides Approvals.
        canActivate: [canViewApprovalsGuard],
        data: { pageTitle: { key: "pamTabApprovals" } },
      },
      {
        path: "my-requests",
        component: PamMyRequestsTabComponent,
        data: { pageTitle: { key: "pamTabMyRequests" } },
      },
      {
        path: "history",
        component: PamHistoryTabComponent,
        data: { pageTitle: { key: "pamTabHistory" } },
      },
      {
        // One request, as a dialog over whichever tab it was opened from, which stays mounted
        // underneath. A notification click lands here.
        path: "requests/:id",
        component: PamRequestRouteComponent,
        data: { pageTitle: { key: "pamAccessRequestTitle" } },
      },
    ],
  },
];
