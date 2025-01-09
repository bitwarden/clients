// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Subscription } from "rxjs";

import { ScheduledTaskName } from "./scheduled-task-name.enum";

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
