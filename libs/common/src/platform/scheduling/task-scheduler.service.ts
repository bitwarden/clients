// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { asyncScheduler, SchedulerLike, Subscription } from "rxjs";

import { ScheduledTaskName } from "./scheduled-task-name.enum";

/**
 *
 * @param taskScheduler
 * @param taskName
 * @returns
 */
export function toScheduler(
  taskScheduler: TaskSchedulerService,
  taskName: ScheduledTaskName,
): SchedulerLike {
  return new TaskSchedulerSheduler(taskScheduler, taskName);
}

class TaskSchedulerSheduler implements SchedulerLike {
  constructor(
    private readonly taskSchedulerService: TaskSchedulerService,
    private readonly taskName: ScheduledTaskName,
  ) {}

  schedule<T>(work: (state?: T) => void, delay?: number, state?: T): Subscription {
    this.taskSchedulerService.registerTaskHandler(this.taskName, () => work(state));
    return this.taskSchedulerService.setTimeout(this.taskName, delay ?? 0);
  }

  now(): number {
    return asyncScheduler.now();
  }
}

export abstract class TaskSchedulerService {
  protected taskHandlers: Map<string, () => void>;
  abstract setTimeout(taskName: ScheduledTaskName, delayInMs: number): Subscription;
  abstract setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    initialDelayInMs?: number,
  ): Subscription;
  abstract registerTaskHandler(taskName: ScheduledTaskName, handler: () => void): void;
  abstract unregisterTaskHandler(taskName: ScheduledTaskName): void;
  protected abstract triggerTask(taskName: ScheduledTaskName, periodInMinutes?: number): void;
}
