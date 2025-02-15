// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { asyncScheduler, SchedulerLike, Subscription } from "rxjs";

import { ScheduledTaskName } from "./scheduled-task-name.enum";

/**
 * Creates a RXJS scheduler based on a {@link TaskSchedulerService}.
 *
 * @description On MV3 browser extensions this uses the `chrome.alarms` API. As such you need
 * to be careful that you observable is subscribed to during startup of the service worker.
 * This ensures that if the service worker dies and awakens for a chrome alarm event, then
 * your code will be guaranteed to be added. The scheduler returned here should behave
 * similarly to the built in {@link https://rxjs.dev/api/index/const/asyncScheduler asyncScheduler}
 * that is the default to many rxjs operators.
 *
 * @link https://rxjs.dev/guide/scheduler#using-schedulers
 *
 * @example
 * ```ts
 * class MyService {
 *   constructor(messageListener: MessageListener, taskScheduler: TaskSchedulerService) {
 *     messageListener.messages$(MY_MESSAGE).pipe(
 *        debounceTime(
 *          10 * 1000,
 *          toScheduler(taskScheduler, ShedulerTaskNames.myTaskName),
 *        ),
 *     )
 *       .subscribe((msg) => this.doThing(msg));
 *   }
 * }
 * ```
 *
 * @param taskScheduler The task scheduler service to use to shedule RXJS work.
 * @param taskName The name of the task that the handler should be registered and scheduled based on.
 * @returns A SchedulerLike object that can be passed in to RXJS operators like `delay` and `timeout`.
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
