import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CardComponent, ScrollLayoutDirective, SearchModule } from "@bitwarden/components";
import { DangerZoneComponent } from "@bitwarden/web-vault/app/auth/settings/account/danger-zone.component";
import { OrganizationPlansComponent } from "@bitwarden/web-vault/app/billing";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { OssModule } from "@bitwarden/web-vault/app/oss.module";

import { InvoicesComponent } from "../../billing/providers/billing-history/invoices.component";
import { NoInvoicesComponent } from "../../billing/providers/billing-history/no-invoices.component";
import { ProviderBillingHistoryComponent } from "../../billing/providers/billing-history/provider-billing-history.component";
import { CreateClientDialogComponent } from "../../billing/providers/clients/create-client-dialog.component";
import { ManageClientNameDialogComponent } from "../../billing/providers/clients/manage-client-name-dialog.component";
import { ManageClientSubscriptionDialogComponent } from "../../billing/providers/clients/manage-client-subscription-dialog.component";
import { SetupBusinessUnitComponent } from "../../billing/providers/setup/setup-business-unit.component";
import { ProviderSubscriptionStatusComponent } from "../../billing/providers/subscription/provider-subscription-status.component";
import { ProviderSubscriptionComponent } from "../../billing/providers/subscription/provider-subscription.component";
import { ProviderWarningsModule } from "../../billing/providers/warnings/provider-warnings.module";

import { AddExistingOrganizationDialogComponent } from "./clients/add-existing-organization-dialog.component";
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
    ProviderWarningsModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
  ],
  declarations: [
    AcceptProviderComponent,
    AccountComponent,
    BulkConfirmDialogComponent,
    BulkRemoveDialogComponent,
    EventsComponent,
    MembersComponent,
    SetupComponent,
    SetupProviderComponent,
    AddEditMemberDialogComponent,
    AddExistingOrganizationDialogComponent,
    CreateClientDialogComponent,
    InvoicesComponent,
    ManageClientNameDialogComponent,
    ManageClientSubscriptionDialogComponent,
    NoInvoicesComponent,
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
