import { NgModule } from "@angular/core";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { BannerModule } from "../../../../../../libs/components/src/banner/banner.module";
import { UserVerificationModule } from "../../auth/shared/components/user-verification";
import { HeaderModule } from "../../layouts/header/header.module";
import { BillingSharedModule } from "../shared";

import { AdjustSubscription } from "./adjust-subscription.component";
import { BillingSyncApiKeyComponent } from "./billing-sync-api-key.component";
import { BillingSyncKeyComponent } from "./billing-sync-key.component";
import { ChurnMitigationOfferDialogComponent } from "./churn-mitigation-offer-dialog.component";
import { DownloadLicenceDialogComponent } from "./download-license.component";
import { OrgBillingHistoryViewComponent } from "./organization-billing-history-view.component";
import { OrganizationBillingRoutingModule } from "./organization-billing-routing.module";
import { OrganizationSubscriptionSelfhostComponent } from "./organization-subscription-selfhost.component";
import { SecretsManagerAdjustSubscriptionComponent } from "./sm-adjust-subscription.component";
import { SecretsManagerSubscribeStandaloneComponent } from "./sm-subscribe-standalone.component";
import { SubscriptionHiddenComponent } from "./subscription-hidden.component";
import { OrganizationScheduledPriceIncreaseWarningComponent } from "./warnings/components";

@NgModule({
  imports: [
    OrganizationBillingRoutingModule,
    UserVerificationModule,
    BillingSharedModule,
    HeaderModule,
    BannerModule,
    OrganizationScheduledPriceIncreaseWarningComponent,
    ChurnMitigationOfferDialogComponent,
    AdjustSubscription,
    SecretsManagerAdjustSubscriptionComponent,
    SecretsManagerSubscribeStandaloneComponent,
  ],
  declarations: [
    BillingSyncApiKeyComponent,
    BillingSyncKeyComponent,
    DownloadLicenceDialogComponent,
    OrganizationSubscriptionSelfhostComponent,
    OrgBillingHistoryViewComponent,
    SubscriptionHiddenComponent,
  ],
})
export class OrganizationBillingModule {}
