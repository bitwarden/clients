import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthGuard } from "@bitwarden/angular/auth/guards";
import { buildFlaggedRoute } from "@bitwarden/web-vault/app/oss-routing.module";

import { organizationEnabledGuard } from "./guards/sm-org-enabled.guard";
import { canActivateSM } from "./guards/sm.guard";
import { LayoutComponent } from "./layout/layout.component";
import { NavigationComponent } from "./layout/navigation.component";
import { OverviewModule } from "./overview/overview.module";
import { ProjectsModule } from "./projects/projects.module";
import { SecretsModule } from "./secrets/secrets.module";
import { ServiceAccountsModule } from "./service-accounts/service-accounts.module";
import { SettingsModule } from "./settings/settings.module";
import { OrgSuspendedComponent } from "./shared/org-suspended.component";
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
        canActivate: [AuthGuard],
        children: [
          {
            path: "",
            component: NavigationComponent,
            outlet: "sidebar",
          },
          {
            path: "",
            canActivate: [organizationEnabledGuard],
            children: [
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
                  titleId: "machineAccounts",
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
          {
            path: "organization-suspended",
            component: OrgSuspendedComponent,
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
