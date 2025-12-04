import { Observable, Subscription } from "rxjs";

import { SecurityTaskId, UserId } from "@bitwarden/common/types/guid";

import { SecurityTask } from "../models";

export abstract class TaskService {
  /**
   * Observable indicating if tasks are enabled for a given user.
   *
   * @remarks Internally, this checks the user's organization details to determine if tasks are enabled.
   * @param userId
   */
  abstract tasksEnabled$(userId: UserId): Observable<boolean>;

  /**
   * Observable of all tasks for a given user.
   * @param userId
   */
  abstract tasks$(userId: UserId): Observable<SecurityTask[]>;

  /**
   * Observable of pending tasks for a given user.
   * @param userId
   */
  abstract pendingTasks$(userId: UserId): Observable<SecurityTask[]>;

  /**
   * Observable of completed tasks for a given user.
   * @param userId
   */
  abstract completedTasks$(userId: UserId): Observable<SecurityTask[]>;

  /**
   * Retrieves tasks from the API for a given user and updates the local state.
   * @param userId
   */
  abstract refreshTasks(userId: UserId): Promise<void>;

  /**
   * Clears all the tasks from state for the given user.
   * @param userId
   */
  abstract clear(userId: UserId): Promise<void>;

  /**
   * Marks a task as complete in local state and updates the server.
   * @param taskId - The ID of the task to mark as complete.
   * @param userId - The user who is completing the task.
   */
  abstract markAsComplete(taskId: SecurityTaskId, userId: UserId): Promise<void>;

  /**
   * Creates a subscription for pending security task notifications or completed syncs for unlocked users.
   */
  abstract listenForTaskNotifications(): Subscription;
}
