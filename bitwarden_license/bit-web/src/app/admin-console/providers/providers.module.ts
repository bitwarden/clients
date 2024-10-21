import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule } from "@bitwarden/components";
import { DangerZoneComponent } from "@bitwarden/web-vault/app/auth/settings/account/danger-zone.component";
import { OrganizationPlansComponent, TaxInfoComponent } from "@bitwarden/web-vault/app/billing";
import { OssModule } from "@bitwarden/web-vault/app/oss.module";

import {
  CreateClientDialogComponent,
  NoClientsComponent,
  ManageClientNameDialogComponent,
  ManageClientsComponent,
  ManageClientSubscriptionDialogComponent,
  ProviderBillingHistoryComponent,
  ProviderSubscriptionComponent,
  ProviderSubscriptionStatusComponent,
} from "../../billing/providers";

import { AddOrganizationComponent } from "./clients/add-organization.component";
import { ClientsComponent } from "./clients/clients.component";
import { CreateOrganizationComponent } from "./clients/create-organization.component";
import { AcceptProviderComponent } from "./manage/accept-provider.component";
import { AddEditMemberDialogComponent } from "./manage/dialogs/add-edit-member-dialog.component";
import { BulkConfirmDialogComponent } from "./manage/dialogs/bulk-confirm-dialog.component";
import { BulkRemoveDialogComponent } from "./manage/dialogs/bulk-remove-dialog.component";
import { EventsComponent } from "./manage/events.component";
import { MembersComponent } from "./manage/members.component";
import { UserAddEditComponent } from "./manage/user-add-edit.component";
import { ProvidersLayoutComponent } from "./providers-layout.component";
import { ProvidersRoutingModule } from "./providers-routing.module";
import { WebProviderService } from "./services/web-provider.service";
import { AccountComponent } from "./settings/account.component";
import { SetupProviderComponent } from "./setup/setup-provider.component";
import { SetupComponent } from "./setup/setup.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    OssModule,
    JslibModule,
    ProvidersRoutingModule,
    OrganizationPlansComponent,
    SearchModule,
    ProvidersLayoutComponent,
    TaxInfoComponent,
    DangerZoneComponent,
    ScrollingModule,
  ],
  declarations: [
    AcceptProviderComponent,
    AccountComponent,
    AddOrganizationComponent,
    BulkConfirmDialogComponent,
    BulkRemoveDialogComponent,
    ClientsComponent,
    CreateOrganizationComponent,
    EventsComponent,
    MembersComponent,
    SetupComponent,
    SetupProviderComponent,
    UserAddEditComponent,
    AddEditMemberDialogComponent,
    CreateClientDialogComponent,
    NoClientsComponent,
    ManageClientsComponent,
    ManageClientNameDialogComponent,
    ManageClientSubscriptionDialogComponent,
    ProviderBillingHistoryComponent,
    ProviderSubscriptionComponent,
    ProviderSubscriptionStatusComponent,
  ],
  providers: [WebProviderService],
})
export class ProvidersModule {}
