import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { AnonLayoutWrapperComponent } from "@bitwarden/auth/angular";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { FrontendLayoutComponent } from "@bitwarden/web-vault/app/layouts/frontend-layout.component";
import { UserLayoutComponent } from "@bitwarden/web-vault/app/layouts/user-layout.component";

import {
  ManageClientsComponent,
  ProviderSubscriptionComponent,
  hasConsolidatedBilling,
  ProviderBillingHistoryComponent,
} from "../../billing/providers";

import { ClientsComponent } from "./clients/clients.component";
import { CreateOrganizationComponent } from "./clients/create-organization.component";
import { providerPermissionsGuard } from "./guards/provider-permissions.guard";
import { AcceptProviderComponent } from "./manage/accept-provider.component";
import { EventsComponent } from "./manage/events.component";
import { MembersComponent } from "./manage/members.component";
import { ProvidersLayoutComponent } from "./providers-layout.component";
import { ProvidersComponent } from "./providers.component";
import { AccountComponent } from "./settings/account.component";
import { SetupProviderComponent } from "./setup/setup-provider.component";
import { SetupComponent } from "./setup/setup.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [authGuard],
    component: UserLayoutComponent,
    children: [
      {
        path: "",
        canActivate: [authGuard],
        component: ProvidersComponent,
        data: { titleId: "providers" },
      },
    ],
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
    ],
  },
  {
    path: "",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "accept-provider",
        component: AcceptProviderComponent,
        data: {
          pageTitle: {
            key: "joinProvider",
          },
          titleId: "acceptProvider",
        },
      },
    ],
  },
  {
    path: "",
    canActivate: [authGuard],
    children: [
      {
        path: "setup",
        component: SetupComponent,
      },
      {
        path: ":providerId",
        component: ProvidersLayoutComponent,
        canActivate: [providerPermissionsGuard()],
        children: [
          { path: "", pathMatch: "full", redirectTo: "clients" },
          { path: "clients/create", component: CreateOrganizationComponent },
          { path: "clients", component: ClientsComponent, data: { titleId: "clients" } },
          {
            path: "manage-client-organizations",
            canActivate: [hasConsolidatedBilling],
            component: ManageClientsComponent,
            data: { titleId: "clients" },
          },
          {
            path: "manage",
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: "members",
              },
              {
                path: "members",
                component: MembersComponent,
                canActivate: [
                  providerPermissionsGuard((provider: Provider) => provider.canManageUsers),
                ],
                data: {
                  titleId: "members",
                },
              },
              {
                path: "events",
                component: EventsComponent,
                canActivate: [
                  providerPermissionsGuard((provider: Provider) => provider.canAccessEventLogs),
                ],
                data: {
                  titleId: "eventLogs",
                },
              },
            ],
          },
          {
            path: "billing",
            canActivate: [hasConsolidatedBilling],
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: "subscription",
              },
              {
                path: "subscription",
                component: ProviderSubscriptionComponent,
                canActivate: [providerPermissionsGuard()],
                data: {
                  titleId: "subscription",
                },
              },
              {
                path: "history",
                component: ProviderBillingHistoryComponent,
                canActivate: [providerPermissionsGuard()],
                data: {
                  titleId: "billingHistory",
                },
              },
            ],
          },
          {
            path: "settings",
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: "account",
              },
              {
                path: "account",
                component: AccountComponent,
                canActivate: [
                  providerPermissionsGuard((provider: Provider) => provider.isProviderAdmin),
                ],
                data: {
                  titleId: "myProvider",
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
