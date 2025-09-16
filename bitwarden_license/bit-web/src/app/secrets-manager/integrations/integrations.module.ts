import { NgModule } from "@angular/core";

import { HecOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/hec-organization-integration-service";
import { OrganizationIntegrationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-configuration-api.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { safeProvider } from "@bitwarden/ui-common";

import { IntegrationCardComponent } from "../../dirt/organization-integrations/integration-card/integration-card.component";
import { IntegrationGridComponent } from "../../dirt/organization-integrations/integration-grid/integration-grid.component";
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
  providers: [
    safeProvider({
      provide: HecOrganizationIntegrationService,
      useClass: HecOrganizationIntegrationService,
      deps: [OrganizationIntegrationApiService, OrganizationIntegrationConfigurationApiService],
    }),
    safeProvider({
      provide: OrganizationIntegrationApiService,
      useClass: OrganizationIntegrationApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: OrganizationIntegrationConfigurationApiService,
      useClass: OrganizationIntegrationConfigurationApiService,
      deps: [ApiService],
    }),
  ],
  declarations: [IntegrationsComponent],
})
export class IntegrationsModule {}
