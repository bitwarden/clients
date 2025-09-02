import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CardComponent, ScrollLayoutDirective, SearchModule } from "@bitwarden/components";
import { DangerZoneComponent } from "@bitwarden/web-vault/app/auth/settings/account/danger-zone.component";
import { OrganizationPlansComponent } from "@bitwarden/web-vault/app/billing";
import { PaymentComponent } from "@bitwarden/web-vault/app/billing/shared/payment/payment.component";
import { OssModule } from "@bitwarden/web-vault/app/oss.module";

import {
  CreateClientDialogComponent,
  ManageClientNameDialogComponent,
  ManageClientSubscriptionDialogComponent,
  ProviderBillingHistoryComponent,
  ProviderSubscriptionComponent,
  ProviderSubscriptionStatusComponent,
} from "../../billing/providers";
import { AddExistingOrganizationDialogComponent } from "../../billing/providers/clients/add-existing-organization-dialog.component";
import { SetupBusinessUnitComponent } from "../../billing/providers/setup/setup-business-unit.component";
import { ProviderWarningsModule } from "../../billing/providers/warnings/provider-warnings.module";

import { AddOrganizationComponent } from "./clients/add-organization.component";
import { CreateOrganizationComponent } from "./clients/create-organization.component";
import { AcceptProviderComponent } from "./manage/accept-provider.component";
import { AddEditMemberDialogComponent } from "./manage/dialogs/add-edit-member-dialog.component";
import { BulkConfirmDialogComponent } from "./manage/dialogs/bulk-confirm-dialog.component";
import { BulkRemoveDialogComponent } from "./manage/dialogs/bulk-remove-dialog.component";
import { EventsComponent } from "./manage/events.component";
import { MembersComponent } from "./manage/members.component";
import { ProvidersLayoutComponent } from "./providers-layout.component";
import { ProvidersRoutingModule } from "./providers-routing.module";
import { ProvidersComponent } from "./providers.component";
import { WebProviderService } from "./services/web-provider.service";
import { AccountComponent } from "./settings/account.component";
import { SetupProviderComponent } from "./setup/setup-provider.component";
import { SetupComponent } from "./setup/setup.component";
import { VerifyRecoverDeleteProviderComponent } from "./verify-recover-delete-provider.component";

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
    DangerZoneComponent,
    ScrollingModule,
    CardComponent,
    ScrollLayoutDirective,
    PaymentComponent,
    ProviderWarningsModule,
  ],
  declarations: [
    AcceptProviderComponent,
    AccountComponent,
    AddOrganizationComponent,
    BulkConfirmDialogComponent,
    BulkRemoveDialogComponent,
    CreateOrganizationComponent,
    EventsComponent,
    MembersComponent,
    SetupComponent,
    SetupProviderComponent,
    AddEditMemberDialogComponent,
    AddExistingOrganizationDialogComponent,
    CreateClientDialogComponent,
    ManageClientNameDialogComponent,
    ManageClientSubscriptionDialogComponent,
    ProviderBillingHistoryComponent,
    ProviderSubscriptionComponent,
    ProviderSubscriptionStatusComponent,
    ProvidersComponent,
    VerifyRecoverDeleteProviderComponent,
    SetupBusinessUnitComponent,
  ],
  providers: [WebProviderService],
})
export class ProvidersModule {}
