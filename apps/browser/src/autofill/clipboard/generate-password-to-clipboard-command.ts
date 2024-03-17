import { firstValueFrom } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

import { setAlarmTime } from "../../platform/alarms/alarm-state";

import { clearClipboardAlarmName } from "./clear-clipboard";
import { copyToClipboard } from "./copy-to-clipboard-command";

export class GeneratePasswordToClipboardCommand {
  constructor(
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
  ) {}

  async getClearClipboard() {
    return await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);
  }

  async generatePasswordToClipboard(tab: chrome.tabs.Tab) {
    const [options] = await this.passwordGenerationService.getOptions();
    const password = await this.passwordGenerationService.generatePassword(options);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    copyToClipboard(tab, password);

    const clearClipboard = await this.getClearClipboard();

    if (clearClipboard != null) {
      await setAlarmTime(clearClipboardAlarmName, clearClipboard * 1000);
    }
  }
}
