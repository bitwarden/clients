import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { OrganizationCountsResponse } from "./models/responses/counts.response";

@Injectable({
  providedIn: "root",
})
export class SecretsManagerService {
  constructor(private apiService: ApiService) {}

  async getCounts(organizationId: string): Promise<OrganizationCountsResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/sm-counts",
      null,
      true,
      true,
    );
    return new OrganizationCountsResponse(r);
  }
}
