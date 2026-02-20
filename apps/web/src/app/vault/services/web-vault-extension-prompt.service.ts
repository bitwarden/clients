import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition, WELCOME_EXTENSION_DIALOG_DISK } from "@bitwarden/state";

import { WebVaultExtensionPromptDialogComponent } from "../components/web-vault-extension-prompt/web-vault-extension-prompt-dialog.component";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";

export const WELCOME_EXTENSION_DIALOG_DISMISSED = new UserKeyDefinition<boolean>(
  WELCOME_EXTENSION_DIALOG_DISK,
  "vaultWelcomeExtensionDialogDismissed",
  {
    deserializer: (dismissed) => dismissed,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class WebVaultExtensionPromptService {
  private stateProvider = inject(StateProvider);
  private webBrowserInteractionService = inject(WebBrowserInteractionService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);

  /**
   * Conditionally prompts the user to install the web extension
   */
  async conditionallyPromptUserForExtension(userId: UserId) {
    const featureFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM29438_WelcomeDialogWithExtensionPrompt,
    );

    if (!featureFlagEnabled) {
      return false;
    }

    // Extension check takes time, trigger it early
    const hasExtensionInstalled = firstValueFrom(
      this.webBrowserInteractionService.extensionInstalled$,
    );

    const hasDismissedExtensionPrompt = await firstValueFrom(
      this.getDialogDismissedState(userId).state$.pipe(map((dismissed) => dismissed ?? false)),
    );
    if (hasDismissedExtensionPrompt) {
      return false;
    }

    const profileIsWithinThresholds = await this.profileIsWithinThresholds();
    if (!profileIsWithinThresholds) {
      return false;
    }

    if (await hasExtensionInstalled) {
      return false;
    }

    const dialogRef = WebVaultExtensionPromptDialogComponent.open(this.dialogService);
    await firstValueFrom(dialogRef.closed);

    return true;
  }

  /** Returns the SingleUserState for the dialog dismissed state */
  getDialogDismissedState(userId: UserId) {
    return this.stateProvider.getUser(userId, WELCOME_EXTENSION_DIALOG_DISMISSED);
  }

  /**
   * Returns true if the user's profile is within the defined thresholds for showing the extension prompt, false otherwise.
   * Thresholds are defined as account age between a configurable number of days and 30 days.
   */
  private async profileIsWithinThresholds() {
    const creationDate = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.creationDate)),
    );

    // When account or creationDate is not available for some reason,
    // default to not showing the prompt to avoid disrupting the user.
    if (!creationDate) {
      return false;
    }

    const minAccountAgeDays = await this.configService.getFeatureFlag(
      FeatureFlag.PM29438_DialogWithExtensionPromptAccountAge,
    );

    const now = new Date();
    const accountAgeMs = now.getTime() - creationDate.getTime();
    const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

    const minAgeDays = minAccountAgeDays ?? 0;
    const maxAgeDays = 30;

    return accountAgeDays >= minAgeDays && accountAgeDays < maxAgeDays;
  }
}
