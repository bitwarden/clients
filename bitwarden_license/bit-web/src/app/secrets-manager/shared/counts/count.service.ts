import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { OrganizationCountsResponse } from "./models/responses/organization-counts.response";
import { ProjectCountsResponse } from "./models/responses/project-counts.response";
import { ServiceAccountCountsResponse } from "./models/responses/service-account-counts.response";

@Injectable({
  providedIn: "root",
})
export class CountService {
  constructor(private apiService: ApiService) {}

  async getOrganizationCounts(organizationId: string): Promise<OrganizationCountsResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/sm-counts",
      null,
      true,
      true,
    );
    return new OrganizationCountsResponse(r);
  }

  async getProjectCounts(projectId: string): Promise<ProjectCountsResponse> {
    const r = await this.apiService.send(
      "GET",
      "/projects/" + projectId + "/sm-counts",
      null,
      true,
      true,
    );
    return new ProjectCountsResponse(r);
  }

  async getServiceAccountCounts(serviceAccountId: string): Promise<ServiceAccountCountsResponse> {
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId + "/sm-counts",
      null,
      true,
      true,
    );
    return new ServiceAccountCountsResponse(r);
  }
}
