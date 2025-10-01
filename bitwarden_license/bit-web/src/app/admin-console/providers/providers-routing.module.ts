import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AnonLayoutWrapperComponent } from "@bitwarden/components";
import { FrontendLayoutComponent } from "@bitwarden/web-vault/app/layouts/frontend-layout.component";
import { UserLayoutComponent } from "@bitwarden/web-vault/app/layouts/user-layout.component";

import {
  ManageClientsComponent,
  ProviderSubscriptionComponent,
  ProviderBillingHistoryComponent,
} from "../../billing/providers";
import { ProviderPaymentDetailsComponent } from "../../billing/providers/payment-details/provider-payment-details.component";
import { SetupBusinessUnitComponent } from "../../billing/providers/setup/setup-business-unit.component";

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
      {
        path: "setup-business-unit",
        component: SetupBusinessUnitComponent,
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
          { path: "clients", component: ManageClientsComponent, data: { titleId: "clients" } },
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
            canActivate: [providerPermissionsGuard()],
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: "subscription",
              },
              {
                path: "subscription",
                component: ProviderSubscriptionComponent,
                data: {
                  titleId: "subscription",
                },
              },
              {
                path: "payment-details",
                component: ProviderPaymentDetailsComponent,
                data: {
                  titleId: "paymentDetails",
                },
              },
              {
                path: "history",
                component: ProviderBillingHistoryComponent,
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
