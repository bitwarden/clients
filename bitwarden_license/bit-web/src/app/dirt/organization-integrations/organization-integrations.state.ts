import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

@Injectable({ providedIn: "root" })
export class OrganizationIntegrationsState {
  private integrationsSource = new BehaviorSubject<Integration[]>([]);
  private organizationSource = new BehaviorSubject<Organization>(null);
  integrations$ = this.integrationsSource.asObservable();
  organization$ = this.organizationSource.asObservable();

  setOrganization(val: Organization) {
    this.organizationSource.next(val);
  }

  setIntegrations(val: Integration[]) {
    this.integrationsSource.next(val);
  }

  get organization() {
    return this.organizationSource.value;
  }

  get integrations() {
    return this.integrationsSource.value;
  }
}
