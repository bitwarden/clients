import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared";

import { SecretsManagerAdjustSubscriptionComponent } from "./sm-adjust-subscription.component";
import { SecretsManagerSubscribeStandaloneComponent } from "./sm-subscribe-standalone.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";

@NgModule({
  imports: [SharedModule],
  declarations: [
    SecretsManagerSubscribeComponent,
    SecretsManagerSubscribeStandaloneComponent,
    SecretsManagerAdjustSubscriptionComponent,
  ],
  exports: [
    SecretsManagerSubscribeComponent,
    SecretsManagerSubscribeStandaloneComponent,
    SecretsManagerAdjustSubscriptionComponent,
  ],
})
export class SecretsManagerBillingModule {}
