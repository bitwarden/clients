import { NgModule } from "@angular/core";

import { DatadogOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/datadog-organization-integration-service";
import { HecOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/hec-organization-integration-service";
import { OrganizationIntegrationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-configuration-api.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { safeProvider } from "@bitwarden/ui-common";

import { AdminConsoleIntegrationsComponent } from "./integrations.component";
import { OrganizationIntegrationsRoutingModule } from "./organization-integrations-routing.module";

@NgModule({
  imports: [AdminConsoleIntegrationsComponent, OrganizationIntegrationsRoutingModule],
  providers: [
    safeProvider({
      provide: DatadogOrganizationIntegrationService,
      useClass: DatadogOrganizationIntegrationService,
      deps: [OrganizationIntegrationApiService, OrganizationIntegrationConfigurationApiService],
    }),
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
})
export class OrganizationIntegrationsModule {}
