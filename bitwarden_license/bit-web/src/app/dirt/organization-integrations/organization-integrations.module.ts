import { NgModule } from "@angular/core";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/device-management/device-management.component";
import { OrganizationIntegrationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-configuration-api.service";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { safeProvider } from "@bitwarden/ui-common";

import { EventManagementComponent } from "./event-management/event-management.component";
import { AdminConsoleIntegrationsComponent } from "./integrations.component";
import { OrganizationIntegrationsRoutingModule } from "./organization-integrations-routing.module";
import { OrganizationIntegrationsResolver } from "./organization-integrations.resolver";
import { OrganizationIntegrationsState } from "./organization-integrations.state";
import { SingleSignOnComponent } from "./single-sign-on/single-sign-on.component";
import { UserProvisioningComponent } from "./user-provisioning/user-provisioning.component";

@NgModule({
  imports: [
    AdminConsoleIntegrationsComponent,
    OrganizationIntegrationsRoutingModule,
    SingleSignOnComponent,
    UserProvisioningComponent,
    DeviceManagementComponent,
    EventManagementComponent,
  ],
  providers: [
    OrganizationIntegrationsResolver,
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
      useClass: OrganizationIntegrationsState,
      useAngularDecorators: true,
    }),
  ],
})
export class OrganizationIntegrationsModule {}
