import { Injectable } from "@angular/core";
import { filter, map, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SecurityTaskId, UserId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, TaskService } from "@bitwarden/vault";

import { perUserCache$ } from "../../utils/observable-utilities";
import { SecurityTaskData } from "../models/security-task.data";
import { SecurityTaskResponse } from "../models/security-task.response";
import { SECURITY_TASKS } from "../state/security-task.state";

@Injectable()
export class DefaultTaskService implements TaskService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
    private organizationService: OrganizationService,
  ) {}

  tasksEnabled$ = perUserCache$((userId) => {
    return this.organizationService
      .getAll$(userId)
      .pipe(map((orgs) => orgs.some((o) => o.useRiskInsights)));
  });

  tasks$ = perUserCache$((userId) => {
    return this.taskState(userId).state$.pipe(
      switchMap(async (tasks) => {
        if (tasks == null) {
          await this.fetchTasksFromApi(userId);
        }
        return tasks;
      }),
      filter((tasks) => tasks != null),
      map((tasks) => tasks.map((t) => new SecurityTask(t))),
    );
  });

  pendingTasks$ = perUserCache$((userId) => {
    return this.tasks$(userId).pipe(
      map((tasks) => tasks.filter((t) => t.status === SecurityTaskStatus.Pending)),
    );
  });

  async refreshTasks(userId: UserId): Promise<void> {
    await this.fetchTasksFromApi(userId);
  }

  async clear(userId: UserId): Promise<void> {
    await this.updateTaskState(userId, []);
  }

  async markAsComplete(taskId: SecurityTaskId, userId: UserId): Promise<void> {
    await this.apiService.send("PATCH", `/tasks/${taskId}/complete`, null, true, false);
    await this.refreshTasks(userId);
  }

  /**
   * Fetches the tasks from the API and updates the local state
   * @param userId
   * @private
   */
  private async fetchTasksFromApi(userId: UserId): Promise<void> {
    const r = await this.apiService.send("GET", "/tasks", null, true, true);
    const response = new ListResponse(r, SecurityTaskResponse);

    const taskData = response.data.map((t) => new SecurityTaskData(t));
    await this.updateTaskState(userId, taskData);
  }

  /**
   * Returns the local state for the tasks
   * @param userId
   * @private
   */
  private taskState(userId: UserId) {
    return this.stateProvider.getUser(userId, SECURITY_TASKS);
  }

  /**
   * Updates the local state with the provided tasks and returns the updated state
   * @param userId
   * @param tasks
   * @private
   */
  private updateTaskState(userId: UserId, tasks: SecurityTaskData[]): Promise<SecurityTaskData[]> {
    return this.taskState(userId).update(() => tasks);
  }
}
