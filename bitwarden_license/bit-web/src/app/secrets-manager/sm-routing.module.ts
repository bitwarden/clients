import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthGuard } from "@bitwarden/angular/auth/guards";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";
import { buildFlaggedRoute } from "@bitwarden/web-vault/app/oss-routing.module";

import { LayoutComponent } from "./layout/layout.component";
import { NavigationComponent } from "./layout/navigation.component";
import { OverviewModule } from "./overview/overview.module";
import { ProjectsModule } from "./projects/projects.module";
import { SecretsModule } from "./secrets/secrets.module";
import { ServiceAccountsModule } from "./service-accounts/service-accounts.module";
import { SettingsModule } from "./settings/settings.module";
import { canActivateSM } from "./sm.guard";
import { TrashModule } from "./trash/trash.module";

const routes: Routes = [
  buildFlaggedRoute("secretsManager", {
    path: "",
    children: [
      {
        path: "",
        canActivate: [canActivateSM],
        pathMatch: "full",
        children: [],
      },
      {
        path: ":organizationId",
        component: LayoutComponent,
        canActivate: [AuthGuard, OrganizationPermissionsGuard],
        data: {
          organizationPermissions: (org: Organization) => org.canAccessSecretsManager,
        },
        children: [
          {
            path: "",
            component: NavigationComponent,
            outlet: "sidebar",
          },
          {
            path: "secrets",
            loadChildren: () => SecretsModule,
            data: {
              titleId: "secrets",
            },
          },
          {
            path: "projects",
            loadChildren: () => ProjectsModule,
            data: {
              titleId: "projects",
            },
          },
          {
            path: "service-accounts",
            loadChildren: () => ServiceAccountsModule,
            data: {
              titleId: "serviceAccounts",
            },
          },
          {
            path: "trash",
            loadChildren: () => TrashModule,
            data: {
              titleId: "trash",
            },
          },
          {
            path: "settings",
            loadChildren: () => SettingsModule,
          },
          {
            path: "",
            loadChildren: () => OverviewModule,
            pathMatch: "full",
          },
        ],
      },
    ],
  }),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SecretsManagerRoutingModule {}
