import { NgModule } from "@angular/core";

import { OrganizationIntegrationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-configuration-api.service";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { safeProvider } from "@bitwarden/ui-common";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { IntegrationsRoutingModule } from "./integrations-routing.module";
import { IntegrationsComponent } from "./integrations.component";
import { SecretsIntegrationsState } from "./secrets-integrations.state";
import { SmIntegrationsTabComponent } from "./sm-integrations-tab/sm-integrations-tab.component";

@NgModule({
  imports: [SecretsManagerSharedModule, IntegrationsRoutingModule, SmIntegrationsTabComponent],
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
