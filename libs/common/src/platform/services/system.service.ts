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
      const clearClipboardDelayInSeconds = await firstValueFrom(
        this.autofillSettingsService.clearClipboardDelay$,
      );
      taskTimeoutInMs = clearClipboardDelayInSeconds ? clearClipboardDelayInSeconds * 1000 : null;
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

  async clearPendingClipboard() {
    if (this.clearClipboardTimeoutFunction != null) {
      await this.clearClipboardTimeoutFunction();
      this.clearClipboardTimeoutFunction = null;
    }
  }
}
