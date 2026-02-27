import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrganizationWarningsResponse } from "@bitwarden/web-vault/app/billing/organizations/warnings/types";

@Injectable()
export class OrganizationBillingClient {
  constructor(private apiService: ApiService) {}

  getWarnings = async (organizationId: OrganizationId): Promise<OrganizationWarningsResponse> => {
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/billing/vnext/warnings`,
      null,
      true,
      true,
    );

    return new OrganizationWarningsResponse(response);
  };
}
