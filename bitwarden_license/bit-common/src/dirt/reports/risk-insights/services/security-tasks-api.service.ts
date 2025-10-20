import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

export type TaskMetrics = {
  completedTasks: number;
  totalTasks: number;
};

export class SecurityTasksApiService {
  constructor(private apiService: ApiService) {}

  getTaskMetrics(orgId: OrganizationId): Observable<TaskMetrics> {
    const dbResponse = this.apiService.send(
      "GET",
      `/tasks/${orgId.toString()}/metrics`,
      null,
      true,
      true,
    );

    return from(dbResponse as Promise<TaskMetrics>);
  }
}
