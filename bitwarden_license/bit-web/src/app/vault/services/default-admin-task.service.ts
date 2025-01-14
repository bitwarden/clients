import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/src/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/src/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/src/types/guid";
import { SecurityTaskStatus } from "@bitwarden/vault/src/tasks/enums";
import { SecurityTask } from "@bitwarden/vault/src/tasks/models";
import { SecurityTaskData } from "@bitwarden/vault/src/tasks/models/security-task.data";
import { SecurityTaskResponse } from "@bitwarden/vault/src/tasks/models/security-task.response";

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
    if (status) {
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
    await this.apiService.send("POST", `/tasks/${organizationId}/bulk-create`, tasks, true, true);
  }
}
