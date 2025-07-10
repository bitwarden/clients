import { NgModule } from "@angular/core";

import { IntegrationCardComponent } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/integrations/integration-card/integration-card.component";
import { IntegrationGridComponent } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/integrations/integration-grid/integration-grid.component";

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
