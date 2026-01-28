// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Subscription } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "../../autofill/services/autofill-settings.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { SystemService as SystemServiceAbstraction } from "../abstractions/system.service";
import { Utils } from "../misc/utils";
import { ScheduledTaskNames } from "../scheduling/scheduled-task-name.enum";
import { TaskSchedulerService } from "../scheduling/task-scheduler.service";

export class SystemService implements SystemServiceAbstraction {
  private clearClipboardTimeoutSubscription: Subscription;
  private clearClipboardTimeoutFunction: () => Promise<any> = null;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private taskSchedulerService: TaskSchedulerService,
  ) {
    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.systemClearClipboardTimeout,
      () => this.clearPendingClipboard(),
    );
  }

  async clearClipboard(clipboardValue: string, timeoutMs: number = null): Promise<void> {
    this.clearClipboardTimeoutSubscription?.unsubscribe();

    if (Utils.isNullOrWhitespace(clipboardValue)) {
      return;
    }

    let taskTimeoutInMs = timeoutMs;
    if (!taskTimeoutInMs) {
      const clearClipboardDelaySetting = await firstValueFrom(
        this.autofillSettingsService.clearClipboardDelay$,
      );
      taskTimeoutInMs = this.convertClearClipboardDelayToMs(clearClipboardDelaySetting);
    }

    if (!taskTimeoutInMs) {
      return;
    }

    this.clearClipboardTimeoutFunction = async () => {
      const clipboardValueNow = await this.platformUtilsService.readFromClipboard();
      if (clipboardValue === clipboardValueNow) {
        this.platformUtilsService.copyToClipboard("", { clearing: true });
      }
    };

    this.clearClipboardTimeoutSubscription = this.taskSchedulerService.setTimeout(
      ScheduledTaskNames.systemClearClipboardTimeout,
      taskTimeoutInMs,
    );
  }

  private convertClearClipboardDelayToMs(setting: string): number | null {
    switch (setting) {
      case "never":
        return null;
      case "tenSeconds":
        return 10 * 1000;
      case "twentySeconds":
        return 20 * 1000;
      case "thirtySeconds":
        return 30 * 1000;
      case "oneMinute":
        return 60 * 1000;
      case "twoMinutes":
        return 120 * 1000;
      case "fiveMinutes":
        return 300 * 1000;
      default:
        return 300 * 1000; // Default to 5 minutes
    }
  }

  async clearPendingClipboard() {
    if (this.clearClipboardTimeoutFunction != null) {
      await this.clearClipboardTimeoutFunction();
      this.clearClipboardTimeoutFunction = null;
    }
  }
}
