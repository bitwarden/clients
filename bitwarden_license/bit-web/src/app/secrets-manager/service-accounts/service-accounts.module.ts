import { NgModule } from "@angular/core";

import { BreadcrumbsModule } from "@bitwarden/components";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { AccessListComponent } from "./access/access-list.component";
import { AccessTokenComponent } from "./access/access-tokens.component";
import { AccessTokenCreateDialogComponent } from "./access/dialogs/access-token-create-dialog.component";
import { AccessTokenDialogComponent } from "./access/dialogs/access-token-dialog.component";
import { ExpirationOptionsComponent } from "./access/dialogs/expiration-options.component";
import { ServiceAccountConfigComponent } from "./config/config.component";
import { ServiceAccountDeleteDialogComponent } from "./dialog/service-account-delete-dialog.component";
import { ServiceAccountDialogComponent } from "./dialog/service-account-dialog.component";
import { ServiceAccountEventsComponent } from "./event-logs/service-accounts-events.component";
import { ServiceAccountPeopleComponent } from "./people/service-account-people.component";
import { ServiceAccountProjectsComponent } from "./projects/service-account-projects.component";
import { ServiceAccountComponent } from "./service-account.component";
import { ServiceAccountsListComponent } from "./service-accounts-list.component";
import { ServiceAccountsRoutingModule } from "./service-accounts-routing.module";
import { ServiceAccountsComponent } from "./service-accounts.component";

@NgModule({
  imports: [SecretsManagerSharedModule, ServiceAccountsRoutingModule, BreadcrumbsModule],
  declarations: [
    AccessListComponent,
    AccessTokenComponent,
    AccessTokenCreateDialogComponent,
    AccessTokenDialogComponent,
    ExpirationOptionsComponent,
    ServiceAccountComponent,
    ServiceAccountConfigComponent,
    ServiceAccountDeleteDialogComponent,
    ServiceAccountDialogComponent,
    ServiceAccountEventsComponent,
    ServiceAccountPeopleComponent,
    ServiceAccountProjectsComponent,
    ServiceAccountsComponent,
    ServiceAccountsListComponent,
    ServiceAccountPeopleComponent,
  ],
  providers: [],
})
export class ServiceAccountsModule {}
