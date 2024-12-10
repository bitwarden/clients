import { NgModule } from "@angular/core";

import {
  IntegrationCardComponent,
  IntegrationGridComponent,
} from "@bitwarden/web-vault/app/shared";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { IntegrationsRoutingModule } from "./integrations-routing.module";
import { IntegrationsComponent } from "./integrations.component";

@NgModule({
  imports: [
    SecretsManagerSharedModule,
    IntegrationsRoutingModule,
    IntegrationCardComponent,
    IntegrationGridComponent,
  ],
  declarations: [IntegrationsComponent],
})
export class IntegrationsModule {}
