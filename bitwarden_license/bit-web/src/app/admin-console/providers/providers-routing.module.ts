import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthGuard } from "@bitwarden/angular/auth/guards";
import { Provider } from "@bitwarden/common/models/domain/provider";
import { ProvidersComponent } from "@bitwarden/web-vault/app/admin-console/providers/providers.component";
import { FrontendLayoutComponent } from "@bitwarden/web-vault/app/layouts/frontend-layout.component";

import { ClientsComponent } from "./clients/clients.component";
import { CreateOrganizationComponent } from "./clients/create-organization.component";
import { ProviderPermissionsGuard } from "./guards/provider-permissions.guard";
import { AcceptProviderComponent } from "./manage/accept-provider.component";
import { EventsComponent } from "./manage/events.component";
import { ManageComponent } from "./manage/manage.component";
import { PeopleComponent } from "./manage/people.component";
import { ProvidersLayoutComponent } from "./providers-layout.component";
import { AccountComponent } from "./settings/account.component";
import { SettingsComponent } from "./settings/settings.component";
import { SetupProviderComponent } from "./setup/setup-provider.component";
import { SetupComponent } from "./setup/setup.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [AuthGuard],
    component: ProvidersComponent,
  },
  {
    path: "",
    component: FrontendLayoutComponent,
    children: [
      {
        path: "setup-provider",
        component: SetupProviderComponent,
        data: { titleId: "setupProvider" },
      },
      {
        path: "accept-provider",
        component: AcceptProviderComponent,
        data: { titleId: "acceptProvider" },
      },
    ],
  },
  {
    path: "",
    canActivate: [AuthGuard],
    children: [
      {
        path: "setup",
        component: SetupComponent,
      },
      {
        path: ":providerId",
        component: ProvidersLayoutComponent,
        canActivate: [ProviderPermissionsGuard],
        children: [
          { path: "", pathMatch: "full", redirectTo: "clients" },
          { path: "clients/create", component: CreateOrganizationComponent },
          { path: "clients", component: ClientsComponent, data: { titleId: "clients" } },
          {
            path: "manage",
            component: ManageComponent,
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: "people",
              },
              {
                path: "people",
                component: PeopleComponent,
                canActivate: [ProviderPermissionsGuard],
                data: {
                  titleId: "people",
                  providerPermissions: (provider: Provider) => provider.canManageUsers,
                },
              },
              {
                path: "events",
                component: EventsComponent,
                canActivate: [ProviderPermissionsGuard],
                data: {
                  titleId: "eventLogs",
                  providerPermissions: (provider: Provider) => provider.canAccessEventLogs,
                },
              },
            ],
          },
          {
            path: "settings",
            component: SettingsComponent,
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: "account",
              },
              {
                path: "account",
                component: AccountComponent,
                canActivate: [ProviderPermissionsGuard],
                data: {
                  titleId: "myProvider",
                  providerPermissions: (provider: Provider) => provider.isProviderAdmin,
                },
              },
            ],
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
export class ProvidersRoutingModule {}
