// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable, Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DefaultTaskSchedulerService,
  ScheduledTaskName,
} from "@bitwarden/common/platform/scheduling";
import {
  TASK_SCHEDULER_DISK,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { BrowserApi } from "../../browser/browser-api";
import {
  ActiveAlarm,
  BrowserTaskSchedulerService,
} from "../abstractions/browser-task-scheduler.service";

const ACTIVE_ALARMS = new KeyDefinition(TASK_SCHEDULER_DISK, "activeAlarms", {
  deserializer: (value: ActiveAlarm[]) => value ?? [],
});

export class BrowserTaskSchedulerServiceImplementation
  extends DefaultTaskSchedulerService
  implements BrowserTaskSchedulerService
{
  private activeAlarmsState: GlobalState<ActiveAlarm[]>;
  readonly activeAlarms$: Observable<ActiveAlarm[]>;

  constructor(
    logService: LogService,
    private stateProvider: StateProvider,
  ) {
    super(logService);

    this.activeAlarmsState = this.stateProvider.getGlobal(ACTIVE_ALARMS);
    this.activeAlarms$ = this.activeAlarmsState.state$.pipe(
      map((activeAlarms) => activeAlarms ?? []),
    );

    this.setupOnAlarmListener();
  }

  /**
   * Sets a timeout to execute a callback after a delay. If the delay is less
   * than 1 minute, it will use the global setTimeout. Otherwise, it will
   * create a browser extension alarm to handle the delay.
   *
   * @param taskName - The name of the task, used in defining the alarm.
   * @param delayInMs - The delay in milliseconds.
   */
  setTimeout(taskName: ScheduledTaskName, delayInMs: number): Subscription {
    let timeoutHandle: number | NodeJS.Timeout;
    this.validateRegisteredTask(taskName);

    const delayInMinutes = delayInMs / 1000 / 60;
    this.scheduleAlarm(taskName, {
      delayInMinutes: this.getUpperBoundDelayInMinutes(delayInMinutes),
    }).catch((error) => this.logService.error("Failed to schedule alarm", error));

    // If the delay is less than a minute, we want to attempt to trigger the task through a setTimeout.
    // The alarm previously scheduled will be used as a backup in case the setTimeout fails.
    if (delayInMinutes < this.getUpperBoundDelayInMinutes(delayInMinutes)) {
      timeoutHandle = globalThis.setTimeout(async () => {
        await this.clearScheduledAlarm(taskName);
        await this.triggerTask(taskName);
      }, delayInMs);
    }

    return new Subscription(() => {
      if (timeoutHandle) {
        globalThis.clearTimeout(timeoutHandle);
      }
      this.clearScheduledAlarm(taskName).catch((error) =>
        this.logService.error("Failed to clear alarm", error),
      );
    });
  }

  /**
   * Sets an interval to execute a callback at each interval. If the interval is
   * less than 1 minute, it will use the global setInterval. Otherwise, it will
   * create a browser extension alarm to handle the interval.
   *
   * @param taskName - The name of the task, used in defining the alarm.
   * @param intervalInMs - The interval in milliseconds.
   * @param initialDelayInMs - The initial delay in milliseconds.
   */
  setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    initialDelayInMs?: number,
  ): Subscription {
    this.validateRegisteredTask(taskName);

    const intervalInMinutes = intervalInMs / 1000 / 60;
    const initialDelayInMinutes = initialDelayInMs
      ? initialDelayInMs / 1000 / 60
      : intervalInMinutes;

    if (intervalInMinutes < this.getUpperBoundDelayInMinutes(intervalInMinutes)) {
      return this.setupSteppedIntervalAlarms(taskName, intervalInMs);
    }

    this.scheduleAlarm(taskName, {
      periodInMinutes: this.getUpperBoundDelayInMinutes(intervalInMinutes),
      delayInMinutes: this.getUpperBoundDelayInMinutes(initialDelayInMinutes),
    }).catch((error) => this.logService.error("Failed to schedule alarm", error));

    return new Subscription(() =>
      this.clearScheduledAlarm(taskName).catch((error) =>
        this.logService.error("Failed to clear alarm", error),
      ),
    );
  }

  /**
   * Used in cases where the interval is less than 1 minute. This method will set up a setInterval
   * to initialize expected recurring behavior, then create a series of alarms to handle the
   * expected scheduled task through the alarms api. This is necessary because the alarms
   * api does not support intervals less than 1 minute.
   *
   * @param taskName - The name of the task
   * @param intervalInMs - The interval in milliseconds.
   */
  private setupSteppedIntervalAlarms(
    taskName: ScheduledTaskName,
    intervalInMs: number,
  ): Subscription {
    const alarmMinDelayInMinutes = this.getAlarmMinDelayInMinutes();
    const intervalInMinutes = intervalInMs / 1000 / 60;
    const numberOfAlarmsToCreate = Math.ceil(Math.ceil(1 / intervalInMinutes) / 2) + 1;
    const steppedAlarmPeriodInMinutes = alarmMinDelayInMinutes + intervalInMinutes;
    const steppedAlarmNames: string[] = [];
    for (let alarmIndex = 0; alarmIndex < numberOfAlarmsToCreate; alarmIndex++) {
      const steppedAlarmName = `${taskName}__${alarmIndex}`;
      steppedAlarmNames.push(steppedAlarmName);

      const delayInMinutes = this.getUpperBoundDelayInMinutes(
        alarmMinDelayInMinutes + intervalInMinutes * alarmIndex,
      );

      this.clearScheduledAlarm(steppedAlarmName)
        .then(() =>
          this.scheduleAlarm(steppedAlarmName, {
            periodInMinutes: steppedAlarmPeriodInMinutes,
            delayInMinutes,
          }).catch((error) => this.logService.error("Failed to schedule alarm", error)),
        )
        .catch((error) => this.logService.error("Failed to clear alarm", error));
    }

    let elapsedMs = 0;
    const intervalHandle: number | NodeJS.Timeout = globalThis.setInterval(async () => {
      elapsedMs += intervalInMs;
      const elapsedMinutes = elapsedMs / 1000 / 60;

      if (elapsedMinutes >= alarmMinDelayInMinutes) {
        globalThis.clearInterval(intervalHandle);
        return;
      }

      await this.triggerTask(taskName, intervalInMinutes);
    }, intervalInMs);

    return new Subscription(() => {
      if (intervalHandle) {
        globalThis.clearInterval(intervalHandle);
      }
      steppedAlarmNames.forEach((alarmName) =>
        this.clearScheduledAlarm(alarmName).catch((error) =>
          this.logService.error("Failed to clear alarm", error),
        ),
      );
    });
  }

  /**
   * Clears all scheduled tasks by clearing all browser extension
   * alarms and resetting the active alarms state.
   */
  async clearAllScheduledTasks(): Promise<void> {
    await this.clearAllAlarms();
    await this.updateActiveAlarms([]);
  }

  /**
   * Verifies the state of the active alarms by checking if
   * any alarms have been missed or need to be created.
   */
  async verifyAlarmsState(): Promise<void> {
    const currentTime = Date.now();
    const activeAlarms = await this.getActiveAlarms();

    for (const alarm of activeAlarms) {
      const { alarmName, startTime, createInfo } = alarm;
      const existingAlarm = await this.getAlarm(alarmName);
      if (existingAlarm) {
        continue;
      }

      const shouldAlarmHaveBeenTriggered = createInfo.when && createInfo.when < currentTime;
      const hasSetTimeoutAlarmExceededDelay =
        !createInfo.periodInMinutes &&
        createInfo.delayInMinutes &&
        startTime + createInfo.delayInMinutes * 60 * 1000 < currentTime;
      if (shouldAlarmHaveBeenTriggered || hasSetTimeoutAlarmExceededDelay) {
        await this.triggerTask(alarmName);
        continue;
      }

      this.scheduleAlarm(alarmName, createInfo).catch((error) =>
        this.logService.error("Failed to schedule alarm", error),
      );
    }
  }

  /**
   * Creates a browser extension alarm with the given name and create info.
   *
   * @param alarmName - The name of the alarm.
   * @param createInfo - The alarm create info.
   */
  private async scheduleAlarm(
    alarmName: string,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    const existingAlarm = await this.getAlarm(alarmName);
    if (existingAlarm) {
      this.logService.debug(`Alarm ${alarmName} already exists. Skipping creation.`);
      return;
    }

    await this.createAlarm(alarmName, createInfo);
    await this.setActiveAlarm(alarmName, createInfo);
  }

  /**
   * Gets the active alarms from state.
   */
  private async getActiveAlarms(): Promise<ActiveAlarm[]> {
    return await firstValueFrom(this.activeAlarms$);
  }

  /**
   * Sets an active alarm in state.
   *
   * @param alarmName - The name of the active alarm to set.
   * @param createInfo - The creation info of the active alarm.
   */
  private async setActiveAlarm(
    alarmName: string,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    const activeAlarms = await this.getActiveAlarms();
    const filteredAlarms = activeAlarms.filter((alarm) => alarm.alarmName !== alarmName);
    filteredAlarms.push({
      alarmName,
      startTime: Date.now(),
      createInfo,
    });
    await this.updateActiveAlarms(filteredAlarms);
  }

  /**
   * Deletes an active alarm from state.
   *
   * @param alarmName - The name of the active alarm to delete.
   */
  private async deleteActiveAlarm(alarmName: string): Promise<void> {
    const activeAlarms = await this.getActiveAlarms();
    const filteredAlarms = activeAlarms.filter((alarm) => alarm.alarmName !== alarmName);
    await this.updateActiveAlarms(filteredAlarms || []);
  }

  /**
   * Clears a scheduled alarm by its name and deletes it from the active alarms state.
   *
   * @param alarmName - The name of the alarm to clear.
   */
  async clearScheduledAlarm(alarmName: string): Promise<void> {
    const wasCleared = await this.clearAlarm(alarmName);
    if (wasCleared) {
      await this.deleteActiveAlarm(alarmName);
    }
  }

  /**
   * Updates the active alarms state with the given alarms.
   *
   * @param alarms - The alarms to update the state with.
   */
  private async updateActiveAlarms(alarms: ActiveAlarm[]): Promise<void> {
    await this.activeAlarmsState.update(() => alarms);
  }

  /**
   * Sets up the on alarm listener to handle alarms.
   */
  private setupOnAlarmListener(): void {
    BrowserApi.addListener(chrome.alarms.onAlarm, this.handleOnAlarm);
  }

  /**
   * Handles on alarm events, triggering the alarm if a handler exists.
   *
   * @param alarm - The alarm to handle.
   */
  private handleOnAlarm = async (alarm: chrome.alarms.Alarm): Promise<void> => {
    const { name, periodInMinutes } = alarm;
    await this.triggerTask(name, periodInMinutes);
  };

  /**
   * Triggers an alarm by calling its handler and
   * deleting it if it is a one-time alarm.
   *
   * @param alarmName - The name of the alarm to trigger.
   * @param periodInMinutes - The period in minutes of an interval alarm.
   */
  protected async triggerTask(alarmName: string, periodInMinutes?: number): Promise<void> {
    const taskName = this.getTaskFromAlarmName(alarmName);
    const handler = this.taskHandlers.get(taskName);
    if (!periodInMinutes) {
      await this.deleteActiveAlarm(alarmName);
    }

    if (handler) {
      handler();
    }
  }

  /**
   * Parses and returns the task name from an alarm name.
   *
   * @param alarmName - The alarm name to parse.
   */
  protected getTaskFromAlarmName(alarmName: string): ScheduledTaskName {
    return alarmName.split("__")[0] as ScheduledTaskName;
  }

  /**
   * Clears a new alarm with the given name and create info. Returns a promise
   * that indicates when the alarm has been cleared successfully.
   *
   * @param alarmName - The name of the alarm to create.
   */
  private async clearAlarm(alarmName: string): Promise<boolean> {
    if (this.isNonChromeEnvironment()) {
      return browser.alarms.clear(alarmName);
    }

    return new Promise((resolve) => chrome.alarms.clear(alarmName, resolve));
  }

  /**
   * Clears all alarms that have been set by the extension. Returns a promise
   * that indicates when all alarms have been cleared successfully.
   */
  private clearAllAlarms(): Promise<boolean> {
    if (this.isNonChromeEnvironment()) {
      return browser.alarms.clearAll();
    }

    return new Promise((resolve) => chrome.alarms.clearAll(resolve));
  }

  /**
   * Creates a new alarm with the given name and create info.
   *
   * @param alarmName - The name of the alarm to create.
   * @param createInfo - The creation info for the alarm.
   */
  private async createAlarm(
    alarmName: string,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    if (this.isNonChromeEnvironment()) {
      return browser.alarms.create(alarmName, createInfo);
    }

    return new Promise((resolve) => chrome.alarms.create(alarmName, createInfo, resolve));
  }

  /**
   * Gets the alarm with the given name.
   *
   * @param alarmName - The name of the alarm to get.
   */
  private getAlarm(alarmName: string): Promise<chrome.alarms.Alarm> {
    if (this.isNonChromeEnvironment()) {
      return browser.alarms.get(alarmName);
    }

    return new Promise((resolve) => chrome.alarms.get(alarmName, resolve));
  }

  /**
   * Checks if the environment is a non-Chrome environment. This is used to determine
   * if the browser alarms API should be used in place of the chrome alarms API. This
   * is necessary because the `chrome` polyfill that Mozilla implements does not allow
   * passing the callback parameter in the same way most `chrome.alarm` api calls allow.
   */
  private isNonChromeEnvironment(): boolean {
    return typeof browser !== "undefined" && !!browser.alarms;
  }

  /**
   * Gets the minimum delay in minutes for an alarm. This is used to ensure that the
   * delay is at least 1 minute in non-Chrome environments. In Chrome environments, the
   * delay can be as low as 0.5 minutes.
   */
  private getAlarmMinDelayInMinutes(): number {
    return this.isNonChromeEnvironment() ? 1 : 0.5;
  }

  /**
   * Gets the upper bound delay in minutes for a given delay in minutes.
   *
   * @param delayInMinutes - The delay in minutes.
   */
  private getUpperBoundDelayInMinutes(delayInMinutes: number): number {
    return Math.max(this.getAlarmMinDelayInMinutes(), delayInMinutes);
  }
}
