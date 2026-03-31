// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { asyncScheduler, SchedulerLike, Subscription } from "rxjs";

import { ScheduledTaskName } from "./scheduled-task-name.enum";

/**
 * Creates a RXJS scheduler based on a {@link TaskSchedulerService}.
 *
 * @description This API defers to `TaskSchedulerService` to schedule a task to be ran
 * in the future but the task that is ran is NOT the remainder of your RXJS pipeline. The
 * task you want ran must instead be registered in a location reachable on a service worker
 * startup (on browser). An example of an acceptible location is the constructor of a service
 * you know is created in `MainBackground`. Uses of this API in other clients _can_ have the
 * `registerTaskHandler` call in more places, but in order to have it work across clients
 * it is recommended to register it according to the rules of browser.
 *
 * @link https://rxjs.dev/guide/scheduler#using-schedulers
 *
 * @example
 * ```ts
 * class MyService {
 *   constructor(messageListener: MessageListener, taskScheduler: TaskSchedulerService) {
 *    // VERY IMPORTANT!
 *    this.taskSchedulerService.registerTaskHandler(SchedulerTaskNames.myTaskName, async () => {
 *      await this.runEvent();
 *    });
 *
 *     messageListener.messages$(MY_MESSAGE).pipe(
 *        debounceTime(
 *          10 * 1000,
 *          toScheduler(taskScheduler, ShedulerTaskNames.myTaskName),
 *        ),
 *        switchMap(() => this.runEvent()),
 *     )
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
