import { Subscription } from "rxjs";

import { LogService } from "../abstractions/log.service";
import { ScheduledTaskName } from "../scheduling/scheduled-task-name.enum";
import { TaskSchedulerService } from "../scheduling/task-scheduler.service";

export class DefaultTaskSchedulerService extends TaskSchedulerService {
  constructor(protected logService: LogService) {
    super();

    this.taskHandlers = new Map();
  }

  /**
   * Sets a timeout and returns the timeout id.
   *
   * @param taskName - The name of the task. Unused in the base implementation.
   * @param delayInMs - The delay in milliseconds.
   */
  setTimeout(taskName: ScheduledTaskName, delayInMs: number): Subscription {
    this.validateRegisteredTask(taskName);

    const timeoutHandle = globalThis.setTimeout(() => this.triggerTask(taskName), delayInMs);
    return new Subscription(() => globalThis.clearTimeout(timeoutHandle));
  }

  /**
   * Sets an interval and returns the interval id.
   *
   * @param taskName - The name of the task. Unused in the base implementation.
   * @param intervalInMs - The interval in milliseconds.
   * @param _initialDelayInMs - The initial delay in milliseconds. Unused in the base implementation.
   */
  setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    _initialDelayInMs?: number,
  ): Subscription {
    this.validateRegisteredTask(taskName);

    const intervalHandle = globalThis.setInterval(() => this.triggerTask(taskName), intervalInMs);

    return new Subscription(() => globalThis.clearInterval(intervalHandle));
  }

  /**
   * Registers a task handler.
   *
   * @param taskName - The name of the task.
   * @param handler - The task handler.
   */
  registerTaskHandler(taskName: ScheduledTaskName, handler: () => void) {
    const existingHandler = this.taskHandlers.get(taskName);
    if (existingHandler) {
      this.logService.warning(`Task handler for ${taskName} already exists. Overwriting.`);
      this.unregisterTaskHandler(taskName);
    }

    this.taskHandlers.set(taskName, handler);
  }

  /**
   * Unregisters a task handler.
   *
   * @param taskName - The name of the task.
   */
  unregisterTaskHandler(taskName: ScheduledTaskName) {
    this.taskHandlers.delete(taskName);
  }

  /**
   * Triggers a task.
   *
   * @param taskName - The name of the task.
   * @param _periodInMinutes - The period in minutes. Unused in the base implementation.
   */
  protected async triggerTask(
    taskName: ScheduledTaskName,
    _periodInMinutes?: number,
  ): Promise<void> {
    const handler = this.taskHandlers.get(taskName);
    if (handler) {
      handler();
    }
  }

  /**
   * Validates that a task handler is registered.
   *
   * @param taskName - The name of the task.
   */
  protected validateRegisteredTask(taskName: ScheduledTaskName): void {
    if (!this.taskHandlers.has(taskName)) {
      throw new Error(`Task handler for ${taskName} not registered. Unable to schedule task.`);
    }
  }
}
