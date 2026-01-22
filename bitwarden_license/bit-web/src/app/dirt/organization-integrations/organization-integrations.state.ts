import { Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

@Injectable()
export class OrganizationIntegrationsState {
  private readonly _integrations = signal<Integration[]>([]);
  private readonly _organization = signal<Organization | null>(null);

  // Signals
  integrations = this._integrations.asReadonly();
  organization = this._organization.asReadonly();

  // Observables for backward compatibility
  integrations$ = toObservable(this._integrations);
  organization$ = toObservable(this._organization);

  setOrganization(val: Organization | null) {
    this._organization.set(val);
  }

  setIntegrations(val: Integration[]) {
    this._integrations.set(val);
  }
}
