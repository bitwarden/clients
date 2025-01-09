// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Subscription } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { TaskSchedulerService, ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { ClearClipboard } from "./clear-clipboard";
import { copyToClipboard } from "./copy-to-clipboard-command";

export class GeneratePasswordToClipboardCommand {
  private clearClipboardSubscription: Subscription;

  constructor(
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private taskSchedulerService: TaskSchedulerService,
  ) {
    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.generatePasswordClearClipboardTimeout,
      () => ClearClipboard.run(),
    );
  }

  async getClearClipboard() {
    return await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);
  }

  async generatePasswordToClipboard(tab: chrome.tabs.Tab) {
    const [options] = await this.passwordGenerationService.getOptions();
    const password = await this.passwordGenerationService.generatePassword(options);

    await copyToClipboard(tab, password);

    const clearClipboardDelayInSeconds = await this.getClearClipboard();
    if (!clearClipboardDelayInSeconds) {
      return;
    }

    const timeoutInMs = clearClipboardDelayInSeconds * 1000;
    this.clearClipboardSubscription?.unsubscribe();
    this.clearClipboardSubscription = this.taskSchedulerService.setTimeout(
      ScheduledTaskNames.generatePasswordClearClipboardTimeout,
      timeoutInMs,
    );
  }
}
