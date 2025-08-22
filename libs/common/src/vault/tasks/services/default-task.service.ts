import {
  combineLatest,
  filter,
  map,
  merge,
  Observable,
  of,
  Subscription,
  switchMap,
  distinctUntilChanged,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { NotificationType } from "@bitwarden/common/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SecurityTaskId, UserId } from "@bitwarden/common/types/guid";
import {
  filterOutNullish,
  perUserCache$,
} from "@bitwarden/common/vault/utils/observable-utilities";

import { TaskService } from "../abstractions/task.service";
import { SecurityTaskStatus } from "../enums";
import { SecurityTask, SecurityTaskData, SecurityTaskResponse } from "../models";
import { SECURITY_TASKS } from "../state/security-task.state";

const getUnlockedUserIds = map<Record<UserId, AuthenticationStatus>, UserId[]>((authStatuses) =>
  Object.entries(authStatuses ?? {})
    .filter(([, status]) => status >= AuthenticationStatus.Unlocked)
    .map(([userId]) => userId as UserId),
);

export class DefaultTaskService implements TaskService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
    private organizationService: OrganizationService,
    private authService: AuthService,
    private notificationService: ServerNotificationsService,
    private messageListener: MessageListener,
  ) {}

  tasksEnabled$ = perUserCache$((userId) => {
    return this.organizationService.organizations$(userId).pipe(
      map((orgs) => orgs.some((o) => o.useRiskInsights)),
      distinctUntilChanged(),
    );
  });

  tasks$ = perUserCache$((userId) => {
    return this.tasksEnabled$(userId).pipe(
      switchMap((enabled) => {
        if (!enabled) {
          return of([]);
        }
        return this.taskState(userId).state$.pipe(
          switchMap(async (tasks) => {
            if (tasks == null) {
              await this.fetchTasksFromApi(userId);
              return null;
            }
            return tasks;
          }),
          filterOutNullish(),
          map((tasks) => tasks.map((t) => new SecurityTask(t))),
        );
      }),
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
  private updateTaskState(
    userId: UserId,
    tasks: SecurityTaskData[],
  ): Promise<SecurityTaskData[] | null> {
    return this.taskState(userId).update(() => tasks);
  }

  /**
   * Helper observable that filters the list of unlocked user IDs to only those with tasks enabled.
   * @private
   */
  private getOnlyTaskEnabledUsers = switchMap<UserId[], Observable<UserId[]>>((unlockedUserIds) => {
    if (unlockedUserIds.length === 0) {
      return of([]);
    }

    return combineLatest(
      unlockedUserIds.map((userId) =>
        this.tasksEnabled$(userId).pipe(map((enabled) => (enabled ? userId : null))),
      ),
    ).pipe(map((userIds) => userIds.filter((userId) => userId !== null) as UserId[]));
  });

  /**
   * Helper observable that emits whenever a security task notification is received for a user in the provided list.
   * @private
   */
  private securityTaskNotifications$(filterByUserIds: UserId[]) {
    return this.notificationService.notifications$.pipe(
      filter(
        ([notification, userId]) =>
          notification.type === NotificationType.RefreshSecurityTasks &&
          filterByUserIds.includes(userId),
      ),
      map(([, userId]) => userId),
    );
  }

  /**
   * Helper observable that emits whenever a sync is completed for a user in the provided list.
   */
  private syncCompletedMessage$(filterByUserIds: UserId[]) {
    return this.messageListener.allMessages$.pipe(
      filter((msg) => msg.command === "syncCompleted" && !!msg.successfully && !!msg.userId),
      map((msg) => msg.userId as UserId),
      filter((userId) => filterByUserIds.includes(userId)),
    );
  }

  /**
   * Creates a subscription for pending security task server notifications or completed syncs for unlocked users.
   */
  listenForTaskNotifications(): Subscription {
    return this.authService.authStatuses$
      .pipe(
        getUnlockedUserIds,
        this.getOnlyTaskEnabledUsers,
        filter((allowedUserIds) => allowedUserIds.length > 0),
        switchMap((allowedUserIds) =>
          merge(
            this.securityTaskNotifications$(allowedUserIds),
            this.syncCompletedMessage$(allowedUserIds),
          ),
        ),
        switchMap((userId) => this.refreshTasks(userId)),
      )
      .subscribe();
  }
}
