import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  PasswordHealthReportApplicationDropRequest,
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "../models/api-models.types";

export class CriticalAppsApiService {
  constructor(private apiService: ApiService) {}

  saveCriticalApps(
    requests: PasswordHealthReportApplicationsRequest[],
  ): Observable<PasswordHealthReportApplicationsResponse[]> {
    const dbResponse = this.apiService.send(
      "POST",
      "/reports/password-health-report-applications/",
      requests,
      true,
      true,
    );

    return from(dbResponse as Promise<PasswordHealthReportApplicationsResponse[]>);
  }

  getCriticalApps(orgId: OrganizationId): Observable<PasswordHealthReportApplicationsResponse[]> {
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/password-health-report-applications/${orgId.toString()}`,
      null,
      true,
      true,
    );

    return from(dbResponse as Promise<PasswordHealthReportApplicationsResponse[]>);
  }

  dropCriticalApp(request: PasswordHealthReportApplicationDropRequest): Observable<void> {
    const dbResponse = this.apiService.send(
      "DELETE",
      "/reports/password-health-report-application/",
      request,
      true,
      true,
    );

    return from(dbResponse as Promise<void>);
  }
}
