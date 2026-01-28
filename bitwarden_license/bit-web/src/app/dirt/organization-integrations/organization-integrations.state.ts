import { Injectable, signal } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

@Injectable()
export class OrganizationIntegrationsState {
  private readonly _integrations = signal<Integration[]>([]);
  private readonly _organization = signal<Organization | undefined>(undefined);

  // Signals
  integrations = this._integrations.asReadonly();
  organization = this._organization.asReadonly();

  setOrganization(val: Organization | null) {
    this._organization.set(val ?? undefined);
  }

  setIntegrations(val: Integration[]) {
    this._integrations.set(val);
  }
}
