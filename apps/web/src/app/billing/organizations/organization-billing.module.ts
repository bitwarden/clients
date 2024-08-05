import { NgModule } from "@angular/core";

import { UserVerificationModule } from "../../auth/shared/components/user-verification";
import { LooseComponentsModule } from "../../shared";
import { BillingSharedModule } from "../shared";

import { AdjustSubscription } from "./adjust-subscription.component";
import { BillingSyncApiKeyComponent } from "./billing-sync-api-key.component";
import { BillingSyncKeyComponent } from "./billing-sync-key.component";
import { ChangePlanDialogComponent } from "./change-plan-dialog.component";
import { ChangePlanComponent } from "./change-plan.component";
import { DownloadLicenceDialogComponent } from "./download-license.component";
import { OrgBillingHistoryViewComponent } from "./organization-billing-history-view.component";
import { OrganizationBillingRoutingModule } from "./organization-billing-routing.module";
import { OrganizationPlansComponent } from "./organization-plans.component";
import { OrganizationSubscriptionCloudComponent } from "./organization-subscription-cloud.component";
import { OrganizationSubscriptionSelfhostComponent } from "./organization-subscription-selfhost.component";
import { SecretsManagerAdjustSubscriptionComponent } from "./sm-adjust-subscription.component";
import { SecretsManagerSubscribeStandaloneComponent } from "./sm-subscribe-standalone.component";
import { SubscriptionHiddenComponent } from "./subscription-hidden.component";
import { SubscriptionStatusComponent } from "./subscription-status.component";

@NgModule({
  imports: [
    OrganizationBillingRoutingModule,
    UserVerificationModule,
    BillingSharedModule,
    OrganizationPlansComponent,
    LooseComponentsModule,
  ],
  declarations: [
    AdjustSubscription,
    BillingSyncApiKeyComponent,
    BillingSyncKeyComponent,
    ChangePlanComponent,
    DownloadLicenceDialogComponent,
    OrganizationSubscriptionCloudComponent,
    OrganizationSubscriptionSelfhostComponent,
    OrgBillingHistoryViewComponent,
    SecretsManagerAdjustSubscriptionComponent,
    SecretsManagerSubscribeStandaloneComponent,
    SubscriptionHiddenComponent,
    SubscriptionStatusComponent,
    ChangePlanDialogComponent,
  ],
})
export class OrganizationBillingModule {}
