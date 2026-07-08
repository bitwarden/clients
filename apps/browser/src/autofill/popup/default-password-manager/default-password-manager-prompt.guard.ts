import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { AutofillBrowserSettingsService } from "../../services/autofill-browser-settings.service";

import { DefaultPasswordManagerPromptService } from "./default-password-manager-prompt.service";

export const DefaultPasswordManagerPromptGuard = async () => {
  const router = inject(Router);
  const autofillBrowserSettingsService = inject(AutofillBrowserSettingsService);
  const defaultPasswordManagerPromptService = inject(DefaultPasswordManagerPromptService);

  if (BrowserApi.getBrowserClientVendor(window) === BrowserClientVendors.Unknown) {
    return true;
  }

  if (!(await defaultPasswordManagerPromptService.isEnabled())) {
    return true;
  }

  const isFreshInstallEligible = await firstValueFrom(
    defaultPasswordManagerPromptService.freshInstallEligible$,
  );

  if (!isFreshInstallEligible) {
    return true;
  }

  const hasPromptDismissed = await firstValueFrom(
    defaultPasswordManagerPromptService.promptDismissed$,
  );

  if (hasPromptDismissed) {
    return true;
  }

  if (await autofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete()) {
    await defaultPasswordManagerPromptService.setPromptDismissed();
    return true;
  }

  return router.createUrlTree(["/default-password-manager-prompt"]);
};
