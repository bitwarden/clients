import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

export type SecurityTaskMetricsResponse = {
  totalTasks: number;
  completedTasks: number;
};

export class SecurityTaskMetricsApiService {
  constructor(private apiService: ApiService) {}

  getSecurityTaskMetrics(organizationId: OrganizationId): Observable<SecurityTaskMetricsResponse> {
    const dbResponse = this.apiService.send(
      "GET",
      `/tasks/${organizationId}/metrics`,
      null,
      true,
      true,
    );
    return from(dbResponse as Promise<SecurityTaskMetricsResponse>);
  }
}
