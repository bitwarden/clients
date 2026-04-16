import { Signal } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { Integration } from "../models/integration";
import { OrganizationIntegration } from "../models/organization-integration";

export abstract class IntegrationStateService {
  abstract integrations: Signal<Integration[]>;
  abstract organization: Signal<Organization | undefined>;
  abstract setIntegrations(integrations: Integration[]): void;
  abstract setOrganization(organization: Organization | undefined): void;
  abstract updateIntegrationSettings(
    integrationName: string,
    updatedIntegrationSettings: OrganizationIntegration,
  ): void;
  abstract deleteIntegrationSettings(integrationName: string): void;
}
