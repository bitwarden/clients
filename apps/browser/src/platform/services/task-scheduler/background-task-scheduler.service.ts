// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/common/platform/state";

import { BrowserApi } from "../../browser/browser-api";
import {
  BrowserTaskSchedulerPortActions,
  BrowserTaskSchedulerPortMessage,
  BrowserTaskSchedulerPortName,
} from "../abstractions/browser-task-scheduler.service";

import { BrowserTaskSchedulerServiceImplementation } from "./browser-task-scheduler.service";

export class BackgroundTaskSchedulerService extends BrowserTaskSchedulerServiceImplementation {
  private ports: Set<chrome.runtime.Port> = new Set();

  constructor(logService: LogService, stateProvider: StateProvider) {
    super(logService, stateProvider);

    BrowserApi.addListener(chrome.runtime.onConnect, this.handlePortOnConnect);
  }

  /**
   * Handles a port connection made from the foreground task scheduler.
   *
   * @param port - The port that was connected.
   */
  private handlePortOnConnect = (port: chrome.runtime.Port) => {
    if (port.name !== BrowserTaskSchedulerPortName) {
      return;
    }
    if (!BrowserApi.senderIsInternal(port.sender)) {
      return;
    }

    this.ports.add(port);
    port.onMessage.addListener(this.handlePortMessage);
    port.onDisconnect.addListener(this.handlePortOnDisconnect);
  };

  /**
   * Handles a port disconnection.
   *
   * @param port - The port that was disconnected.
   */
  private handlePortOnDisconnect = (port: chrome.runtime.Port) => {
    port.onMessage.removeListener(this.handlePortMessage);
    port.onDisconnect.removeListener(this.handlePortOnDisconnect);
    this.ports.delete(port);
  };

  /**
   * Handles a message from a port.
   *
   * @param message - The message that was received.
   * @param port - The port that sent the message.
   */
  private handlePortMessage = (
    message: BrowserTaskSchedulerPortMessage,
    port: chrome.runtime.Port,
  ) => {
    const isTaskSchedulerPort = port.name === BrowserTaskSchedulerPortName;
    const { action, taskName, alarmName, delayInMs, intervalInMs } = message;

    if (isTaskSchedulerPort && action === BrowserTaskSchedulerPortActions.setTimeout) {
      super.setTimeout(taskName, delayInMs);
      return;
    }

    if (isTaskSchedulerPort && action === BrowserTaskSchedulerPortActions.setInterval) {
      super.setInterval(taskName, intervalInMs);
      return;
    }

    if (isTaskSchedulerPort && action === BrowserTaskSchedulerPortActions.clearAlarm) {
      super.clearScheduledAlarm(alarmName).catch((error) => this.logService.error(error));
    }
  };
}
