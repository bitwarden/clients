import { signal } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegration } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

export class SecretsIntegrationsState implements IntegrationStateService {
  private readonly _integrations = signal<Integration[]>([]);
  private readonly _organization = signal<Organization | undefined>(undefined);

  // Signals
  integrations = this._integrations.asReadonly();
  organization = this._organization.asReadonly();

  setOrganization(val: Organization | undefined) {
    this._organization.set(val ?? undefined);
  }

  setIntegrations(val: Integration[]) {
    this._integrations.set(val);
  }

  updateIntegrationSettings(
    integrationName: string,
    updatedIntegrationSettings: OrganizationIntegration,
  ) {
    const integrations = this._integrations();
    const index = integrations.findIndex((i) => i.name === integrationName);
    if (index >= 0) {
      const updatedIntegrations = integrations.map((integration, i) =>
        i === index
          ? { ...integration, organizationIntegration: updatedIntegrationSettings }
          : integration,
      );
      this.setIntegrations(updatedIntegrations);
    }
  }

  deleteIntegrationSettings(integrationName: string) {
    const integrations = this._integrations();
    const index = integrations.findIndex((i) => i.name === integrationName);
    if (index >= 0) {
      const updatedIntegrations = integrations.map((integration, i) =>
        i === index ? { ...integration, organizationIntegration: undefined } : integration,
      );
      this.setIntegrations(updatedIntegrations);
    }
  }
}
