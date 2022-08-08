import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthGuard } from "@bitwarden/angular/guards/auth.guard";
import { Organization } from "@bitwarden/common/models/domain/organization";

import { OrganizationVaultModule } from "../modules/vault/modules/organization-vault/organization-vault.module";

import { OrganizationPermissionsGuard } from "./guards/org-permissions.guard";
import { OrganizationLayoutComponent } from "./layouts/organization-layout.component";
import { CollectionsComponent } from "./manage/collections.component";
import { EventsComponent } from "./manage/events.component";
import { GroupsComponent } from "./manage/groups.component";
import { ManageComponent } from "./manage/manage.component";
import { PeopleComponent } from "./manage/people.component";
import { PoliciesComponent } from "./manage/policies.component";
import {
  canAccessOrgAdmin,
  canAccessManageTab,
  canAccessSettingsTab,
  canAccessToolsTab,
} from "./navigation-permissions";
import { AccountComponent } from "./settings/account.component";
import { OrganizationBillingComponent } from "./settings/organization-billing.component";
import { OrganizationSubscriptionComponent } from "./settings/organization-subscription.component";
import { SettingsComponent } from "./settings/settings.component";
import { TwoFactorSetupComponent } from "./settings/two-factor-setup.component";
import { ExposedPasswordsReportComponent } from "./tools/exposed-passwords-report.component";
import { InactiveTwoFactorReportComponent } from "./tools/inactive-two-factor-report.component";
import { ReusedPasswordsReportComponent } from "./tools/reused-passwords-report.component";
import { ToolsComponent } from "./tools/tools.component";
import { UnsecuredWebsitesReportComponent } from "./tools/unsecured-websites-report.component";
import { WeakPasswordsReportComponent } from "./tools/weak-passwords-report.component";

const routes: Routes = [
  {
    path: ":organizationId",
    component: OrganizationLayoutComponent,
    canActivate: [AuthGuard, OrganizationPermissionsGuard],
    data: {
      permissions: canAccessOrgAdmin,
    },
    children: [
      { path: "", pathMatch: "full", redirectTo: "vault" },
      {
        path: "vault",
        loadChildren: () => OrganizationVaultModule,
      },
      {
        path: "tools",
        component: ToolsComponent,
        canActivate: [OrganizationPermissionsGuard],
        data: {
          permissions: canAccessToolsTab,
        },
        children: [
          {
            path: "",
            pathMatch: "full",
            redirectTo: "import",
          },
          {
            path: "",
            loadChildren: () =>
              import("./tools/import-export/org-import-export.module").then(
                (m) => m.OrganizationImportExportModule
              ),
          },
          {
            path: "exposed-passwords-report",
            component: ExposedPasswordsReportComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "exposedPasswordsReport",
              permissions: (org: Organization) => org.canAccessReports,
            },
          },
          {
            path: "inactive-two-factor-report",
            component: InactiveTwoFactorReportComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "inactive2faReport",
              permissions: (org: Organization) => org.canAccessReports,
            },
          },
          {
            path: "reused-passwords-report",
            component: ReusedPasswordsReportComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "reusedPasswordsReport",
              permissions: (org: Organization) => org.canAccessReports,
            },
          },
          {
            path: "unsecured-websites-report",
            component: UnsecuredWebsitesReportComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "unsecuredWebsitesReport",
              permissions: (org: Organization) => org.canAccessReports,
            },
          },
          {
            path: "weak-passwords-report",
            component: WeakPasswordsReportComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "weakPasswordsReport",
              permissions: (org: Organization) => org.canAccessReports,
            },
          },
        ],
      },
      {
        path: "manage",
        component: ManageComponent,
        canActivate: [OrganizationPermissionsGuard],
        data: {
          permissions: canAccessManageTab,
        },
        children: [
          {
            path: "",
            pathMatch: "full",
            redirectTo: "people",
          },
          {
            path: "collections",
            component: CollectionsComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "collections",
              permissions: (org: Organization) =>
                org.canCreateNewCollections ||
                org.canEditAnyCollection ||
                org.canDeleteAnyCollection ||
                org.canEditAssignedCollections ||
                org.canDeleteAssignedCollections,
            },
          },
          {
            path: "events",
            component: EventsComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "eventLogs",
              permissions: (org: Organization) => org.canAccessEventLogs,
            },
          },
          {
            path: "groups",
            component: GroupsComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "groups",
              permissions: (org: Organization) => org.canManageGroups,
            },
          },
          {
            path: "people",
            component: PeopleComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "people",
              permissions: (org: Organization) => org.canManageUsers || org.canManageUsersPassword,
            },
          },
          {
            path: "policies",
            component: PoliciesComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "policies",
              permissions: (org: Organization) => org.canManagePolicies,
            },
          },
        ],
      },
      {
        path: "settings",
        component: SettingsComponent,
        canActivate: [OrganizationPermissionsGuard],
        data: { permissions: canAccessSettingsTab },
        children: [
          { path: "", pathMatch: "full", redirectTo: "account" },
          { path: "account", component: AccountComponent, data: { titleId: "myOrganization" } },
          {
            path: "two-factor",
            component: TwoFactorSetupComponent,
            data: { titleId: "twoStepLogin" },
          },
          {
            path: "billing",
            component: OrganizationBillingComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: { titleId: "billing", permissions: (org: Organization) => org.canManageBilling },
          },
          {
            path: "subscription",
            component: OrganizationSubscriptionComponent,
            data: { titleId: "subscription" },
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
