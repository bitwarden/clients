import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";

import { organizationEnabledGuard } from "./guards/sm-org-enabled.guard";
import { canActivateSM } from "./guards/sm.guard";
import { IntegrationsModule } from "./integrations/integrations.module";
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
  {
    path: "",
    children: [
      {
        path: "",
        canActivate: [authGuard, canActivateSM],
        pathMatch: "full",
        children: [],
      },
      {
        path: ":organizationId",
        component: LayoutComponent,
        canActivate: [authGuard],
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
                path: "machine-accounts",
                loadChildren: () => ServiceAccountsModule,
                data: {
                  titleId: "machineAccounts",
                },
              },
              {
                path: "integrations",
                loadChildren: () => IntegrationsModule,
                data: {
                  titleId: "integrations",
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
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SecretsManagerRoutingModule {}
