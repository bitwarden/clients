import { TaskSchedulerService, ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";

/**
 * The default interval between background syncs.
 * 300,000ms = 5 minutes
 */
export const DEFAULT_SYNC_INTERVAL_MS = 300000;

/**
 * Service responsible for registering and managing background synchronization for the browser extension.
 * Handles scheduling of periodic sync operations using the task scheduler infrastructure.
 */

export class BackgroundSyncService {
  /**
   * Creates a new instance of BackgroundSyncService.
   * @param taskSchedulerService - Service that handles scheduling and execution of periodic tasks
   */
  constructor(private taskSchedulerService: TaskSchedulerService) {}

  /**
   * Registers a callback function to be executed when the sync interval task is triggered.
   * This associates the sync task name with the provided callback in the task scheduler.
   *
   * @param syncCallback - The function to execute when the sync task is triggered
   */
  register(syncCallback: () => Promise<void>) {
    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.scheduleNextSyncInterval,
      syncCallback,
    );
  }

  /**
   * Initializes the background sync service by scheduling the sync interval task.
   * This sets up a recurring timer that triggers the registered sync callback at regular intervals.
   *
   * @param intervalMs - The interval in milliseconds between sync operations (defaults to 300000ms/5 minutes)
   */
  init(intervalMs: number = DEFAULT_SYNC_INTERVAL_MS) {
    intervalMs = intervalMs < 1 ? DEFAULT_SYNC_INTERVAL_MS : intervalMs;
    this.taskSchedulerService.setInterval(ScheduledTaskNames.scheduleNextSyncInterval, intervalMs);
  }
}
