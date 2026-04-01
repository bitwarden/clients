import { NgModule } from "@angular/core";

import { OrganizationIntegrationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-configuration-api.service";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { FilterIntegrationsPipe } from "@bitwarden/bit-common/dirt/organization-integrations/shared/filter-integrations.pipe";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { safeProvider } from "@bitwarden/ui-common";

import { IntegrationCardComponent } from "../../dirt/organization-integrations/integration-card/integration-card.component";
import { IntegrationGridComponent } from "../../dirt/organization-integrations/integration-grid/integration-grid.component";
import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { IntegrationsRoutingModule } from "./integrations-routing.module";
import { IntegrationsComponent } from "./integrations.component";
import { SecretsIntegrationsState } from "./secrets-integrations.state";

@NgModule({
  imports: [
    SecretsManagerSharedModule,
    IntegrationsRoutingModule,
    IntegrationCardComponent,
    IntegrationGridComponent,
    FilterIntegrationsPipe,
  ],
  providers: [
    safeProvider({
      provide: OrganizationIntegrationService,
      useClass: OrganizationIntegrationService,
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
    safeProvider({
      provide: IntegrationStateService,
      useClass: SecretsIntegrationsState,
      useAngularDecorators: true,
    }),
  ],
  declarations: [IntegrationsComponent],
})
export class IntegrationsModule {}
