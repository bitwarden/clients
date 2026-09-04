import { inject, NgModule } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterModule,
  Routes,
} from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { canAccessReportingTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EventsComponent } from "@bitwarden/web-vault/app/dirt/event-logs";

// eslint-disable-next-line no-restricted-imports
import { ExposedPasswordsReportComponent } from "../../../dirt/reports/pages/organizations/exposed-passwords-report.component";
// eslint-disable-next-line no-restricted-imports
import { InactiveTwoFactorReportComponent } from "../../../dirt/reports/pages/organizations/inactive-two-factor-report.component";
// eslint-disable-next-line no-restricted-imports
import { OrgPasskeyReportComponent } from "../../../dirt/reports/pages/organizations/org-passkey-report.component";
// eslint-disable-next-line no-restricted-imports
import { ReusedPasswordsReportComponent } from "../../../dirt/reports/pages/organizations/reused-passwords-report.component";
// eslint-disable-next-line no-restricted-imports
import { UnsecuredWebsitesReportComponent } from "../../../dirt/reports/pages/organizations/unsecured-websites-report.component";
// eslint-disable-next-line no-restricted-imports
import { WeakPasswordsReportComponent } from "../../../dirt/reports/pages/organizations/weak-passwords-report.component";
import { isEnterpriseOrgGuard } from "../guards/is-enterprise-org.guard";
import { isPaidOrgGuard } from "../guards/is-paid-org.guard";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";
import { organizationRedirectGuard } from "../guards/org-redirect.guard";

import { ReportsHomeComponent } from "./reports-home.component";

/** Feature-flag gate for the member adoption report; the redirect target needs the org id. */
export function canAccessMemberAdoptionReport(): CanActivateFn {
  return async (route: ActivatedRouteSnapshot) => {
    const configService = inject(ConfigService);
    const logService = inject(LogService);
    const router = inject(Router);

    const organizationReports = router.createUrlTree([
      "/organizations",
      route.params.organizationId,
      "reporting",
      "reports",
    ]);

    try {
      const enabled = await configService.getFeatureFlag(FeatureFlag.MemberAdoptionReport);
      return enabled === true ? true : organizationReports;
    } catch (e) {
      logService.error(e);
      return organizationReports;
    }
  };
}

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
          {
            path: "passkey-report",
            component: OrgPasskeyReportComponent,
            data: {
              titleId: "passkeyLoginReport",
            },
            canActivate: [
              isPaidOrgGuard(),
              canAccessFeature(FeatureFlag.PasskeyLoginReport, true, "../reports", false),
            ],
          },
          {
            path: "member-adoption-report",
            loadComponent: () =>
              import("../../../dirt/reports/pages/organizations/member-adoption-report/member-adoption-report.component").then(
                (mod) => mod.MemberAdoptionReportComponent,
              ),
            data: {
              titleId: "memberAdoptionReport",
            },
            canActivate: [
              organizationPermissionsGuard((org) => org.canAccessReports),
              canAccessMemberAdoptionReport(),
              isEnterpriseOrgGuard(),
            ],
          },
        ],
      },
      {
        path: "events",
        component: EventsComponent,
        canActivate: [organizationPermissionsGuard((org) => org.canAccessEventLogs || org.isOwner)],
        data: {
          titleId: "eventLogs",
        },
      },
    ],
  },
];

function getReportRoute(organization: Organization): string | undefined {
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
