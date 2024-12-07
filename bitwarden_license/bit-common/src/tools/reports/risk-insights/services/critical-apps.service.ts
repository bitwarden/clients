import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Guid } from "@bitwarden/common/types/guid";

@Injectable({
  providedIn: "root",
})
export class CriticalAppsService {
  constructor(private apiService: ApiService) {}

  async setCriticalApps(
    criticalApps: PasswordHealthReportApplicationsRequest[],
  ): Promise<PasswordHealthReportApplicationsResponse[]> {
    const response = await this.apiService.send(
      "POST",
      "/reports/password-health-report-applications/",
      criticalApps,
      true,
      true,
    );

    return response.map((r: { id: any; organizationId: any; uri: any }) => {
      return {
        id: r.id,
        organizationId: r.organizationId,
        uri: r.uri,
      };
    });
  }

  async getCriticalApps(orgId: string): Promise<PasswordHealthReportApplicationsResponse[]> {
    const response = await this.apiService.send(
      "GET",
      `/reports/password-health-report-applications/${orgId}`,
      null,
      true,
      true,
    );

    return response.map((r: { id: any; organizationId: any; uri: any }) => {
      return {
        id: r.id,
        organizationId: r.organizationId,
        uri: r.uri,
      };
    });
  }
}

export interface PasswordHealthReportApplicationsRequest {
  organizationId: Guid;
  url: string;
}

export interface PasswordHealthReportApplicationsResponse {
  id: Guid;
  organizationId: Guid;
  uri: string;
}
