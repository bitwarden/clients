import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule } from "@bitwarden/components";
import { DangerZoneComponent } from "@bitwarden/web-vault/app/auth/settings/account/danger-zone.component";
import { OrganizationPlansComponent, TaxInfoComponent } from "@bitwarden/web-vault/app/billing";
import { PaymentMethodWarningsModule } from "@bitwarden/web-vault/app/billing/shared";
import { OssModule } from "@bitwarden/web-vault/app/oss.module";

import {
  CreateClientDialogComponent,
  NoClientsComponent,
  ManageClientNameDialogComponent,
  ManageClientsComponent,
  ManageClientSubscriptionDialogComponent,
  ProviderBillingHistoryComponent,
  ProviderPaymentMethodComponent,
  ProviderSelectPaymentMethodDialogComponent,
  ProviderSubscriptionComponent,
  ProviderSubscriptionStatusComponent,
} from "../../billing/providers";

import { AddOrganizationComponent } from "./clients/add-organization.component";
import { ClientsComponent } from "./clients/clients.component";
import { CreateOrganizationComponent } from "./clients/create-organization.component";
import { AcceptProviderComponent } from "./manage/accept-provider.component";
import { BulkConfirmComponent } from "./manage/bulk/bulk-confirm.component";
import { BulkRemoveComponent } from "./manage/bulk/bulk-remove.component";
import { EventsComponent } from "./manage/events.component";
import { PeopleComponent } from "./manage/people.component";
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
    PaymentMethodWarningsModule,
    TaxInfoComponent,
    DangerZoneComponent,
  ],
  declarations: [
    AcceptProviderComponent,
    AccountComponent,
    AddOrganizationComponent,
    BulkConfirmComponent,
    BulkRemoveComponent,
    ClientsComponent,
    CreateOrganizationComponent,
    EventsComponent,
    PeopleComponent,
    SetupComponent,
    SetupProviderComponent,
    UserAddEditComponent,
    CreateClientDialogComponent,
    NoClientsComponent,
    ManageClientsComponent,
    ManageClientNameDialogComponent,
    ManageClientSubscriptionDialogComponent,
    ProviderBillingHistoryComponent,
    ProviderSubscriptionComponent,
    ProviderSelectPaymentMethodDialogComponent,
    ProviderPaymentMethodComponent,
    ProviderSubscriptionStatusComponent,
  ],
  providers: [WebProviderService],
})
export class ProvidersModule {}
