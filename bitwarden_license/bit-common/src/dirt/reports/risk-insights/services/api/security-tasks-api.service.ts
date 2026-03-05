import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  SecurityTask,
  SecurityTaskData,
  SecurityTaskResponse,
  SecurityTaskStatus,
} from "@bitwarden/common/vault/tasks";

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

  // Could not import from @bitwarden/bit-web
  // Copying from /bitwarden_license/bit-web/src/app/vault/services/default-admin-task.service.ts
  async getAllTasks(
    organizationId: OrganizationId,
    status?: SecurityTaskStatus | undefined,
  ): Promise<SecurityTask[]> {
    const queryParams = new URLSearchParams();

    queryParams.append("organizationId", organizationId);
    if (status !== undefined) {
      queryParams.append("status", status.toString());
    }

    const r = await this.apiService.send(
      "GET",
      `/tasks/organization?${queryParams.toString()}`,
      null,
      true,
      true,
    );
    const response = new ListResponse(r, SecurityTaskResponse);

    return response.data.map((d) => new SecurityTask(new SecurityTaskData(d)));
  }
}
