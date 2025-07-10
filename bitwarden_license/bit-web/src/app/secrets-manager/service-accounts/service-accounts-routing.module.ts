import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AccessTokenComponent } from "./access/access-tokens.component";
import { ServiceAccountConfigComponent } from "./config/config.component";
import { ServiceAccountEventsComponent } from "./event-logs/service-accounts-events.component";
import { serviceAccountAccessGuard } from "./guards/service-account-access.guard";
import { ServiceAccountPeopleComponent } from "./people/service-account-people.component";
import { ServiceAccountProjectsComponent } from "./projects/service-account-projects.component";
import { ServiceAccountComponent } from "./service-account.component";
import { ServiceAccountsComponent } from "./service-accounts.component";

const routes: Routes = [
  {
    path: "",
    component: ServiceAccountsComponent,
  },
  {
    path: ":serviceAccountId",
    component: ServiceAccountComponent,
    canActivate: [serviceAccountAccessGuard],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: "projects",
      },
      {
        path: "access",
        component: AccessTokenComponent,
      },
      {
        path: "people",
        component: ServiceAccountPeopleComponent,
      },
      {
        path: "projects",
        component: ServiceAccountProjectsComponent,
      },
      {
        path: "events",
        component: ServiceAccountEventsComponent,
      },
      {
        path: "config",
        component: ServiceAccountConfigComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ServiceAccountsRoutingModule {}
