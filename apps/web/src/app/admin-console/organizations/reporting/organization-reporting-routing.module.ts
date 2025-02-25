// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, NgModule } from "@angular/core";
import { CanMatchFn, RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { canAccessReportingTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ExposedPasswordsReportComponent } from "../../../tools/reports/pages/organizations/exposed-passwords-report.component";
import { InactiveTwoFactorReportComponent } from "../../../tools/reports/pages/organizations/inactive-two-factor-report.component";
import { ReusedPasswordsReportComponent } from "../../../tools/reports/pages/organizations/reused-passwords-report.component";
import { UnsecuredWebsitesReportComponent } from "../../../tools/reports/pages/organizations/unsecured-websites-report.component";
import { WeakPasswordsReportComponent } from "../../../tools/reports/pages/organizations/weak-passwords-report.component";
/* eslint no-restricted-imports: "error" */
import { isPaidOrgGuard } from "../guards/is-paid-org.guard";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";
import { organizationRedirectGuard } from "../guards/org-redirect.guard";
import { EventsComponent } from "../manage/events.component";

import { ReportsHomeComponent } from "./reports-home.component";

const breadcrumbEventLogsPermission$: CanMatchFn = () =>
  inject(ConfigService)
    .getFeatureFlag$(FeatureFlag.PM12276_BreadcrumbEventLogs)
    .pipe(map((breadcrumbEventLogs) => breadcrumbEventLogs === true));

const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard(canAccessReportingTab)],
    children: [
      {
        path: "",
        pathMatch: "full",
        canActivate: [organizationRedirectGuard(getReportRoute)],
        children: [], // This is required to make the auto redirect work,
      },
      {
        path: "reports",
        component: ReportsHomeComponent,
        canActivate: [organizationPermissionsGuard()],
        data: {
          titleId: "reports",
        },
        children: [
          {
            path: "exposed-passwords-report",
            component: ExposedPasswordsReportComponent,
            data: {
              titleId: "exposedPasswordsReport",
            },
            canActivate: [isPaidOrgGuard()],
          },
          {
            path: "inactive-two-factor-report",
            component: InactiveTwoFactorReportComponent,
            data: {
              titleId: "inactive2faReport",
            },
            canActivate: [isPaidOrgGuard()],
          },
          {
            path: "reused-passwords-report",
            component: ReusedPasswordsReportComponent,
            data: {
              titleId: "reusedPasswordsReport",
            },
            canActivate: [isPaidOrgGuard()],
          },
          {
            path: "unsecured-websites-report",
            component: UnsecuredWebsitesReportComponent,
            data: {
              titleId: "unsecuredWebsitesReport",
            },
            canActivate: [isPaidOrgGuard()],
          },
          {
            path: "weak-passwords-report",
            component: WeakPasswordsReportComponent,
            data: {
              titleId: "weakPasswordsReport",
            },
            canActivate: [isPaidOrgGuard()],
          },
        ],
      },
      // Event routing is temporarily duplicated
      {
        path: "events",
        component: EventsComponent,
        canMatch: [breadcrumbEventLogsPermission$], // if this matches, the flag is ON
        canActivate: [
          organizationPermissionsGuard(
            (org) => (org.canAccessEventLogs && org.useEvents) || org.isOwner,
          ),
        ],
        data: {
          titleId: "eventLogs",
        },
      },
      {
        path: "events",
        component: EventsComponent,
        canActivate: [organizationPermissionsGuard((org) => org.canAccessEventLogs)],
        data: {
          titleId: "eventLogs",
        },
      },
    ],
  },
];

function getReportRoute(organization: Organization): string {
  if (organization.canAccessEventLogs) {
    return "events";
  }
  if (organization.canAccessReports) {
    return "reports";
  }
  return undefined;
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationReportingRoutingModule {}
