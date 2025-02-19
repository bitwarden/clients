import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  SecurityTask,
  SecurityTaskData,
  SecurityTaskResponse,
  SecurityTaskStatus,
} from "@bitwarden/vault";

import { AdminTaskService, CreateTasksRequest } from "./abstractions/admin-task.abstraction";

@Injectable()
export class DefaultAdminTaskService implements AdminTaskService {
  constructor(private apiService: ApiService) {}

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

  async bulkCreateTasks(
    organizationId: OrganizationId,
    tasks: CreateTasksRequest[],
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      `/tasks/${organizationId}/bulk-create`,
      { tasks },
      true,
      true,
    );
  }
}
