// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { TaskSchedulerService, ScheduledTaskName } from "@bitwarden/common/platform/scheduling";

export const BrowserTaskSchedulerPortName = "browser-task-scheduler-port";

export const BrowserTaskSchedulerPortActions = {
  setTimeout: "setTimeout",
  setInterval: "setInterval",
  clearAlarm: "clearAlarm",
} as const;
export type BrowserTaskSchedulerPortAction = keyof typeof BrowserTaskSchedulerPortActions;

export type BrowserTaskSchedulerPortMessage = {
  action: BrowserTaskSchedulerPortAction;
  taskName: ScheduledTaskName;
  alarmName?: string;
  delayInMs?: number;
  intervalInMs?: number;
};

export type ActiveAlarm = {
  alarmName: string;
  startTime: number;
  createInfo: chrome.alarms.AlarmCreateInfo;
};

export abstract class BrowserTaskSchedulerService extends TaskSchedulerService {
  activeAlarms$: Observable<ActiveAlarm[]>;
  abstract clearAllScheduledTasks(): Promise<void>;
  abstract verifyAlarmsState(): Promise<void>;
  abstract clearScheduledAlarm(alarmName: string): Promise<void>;
}
