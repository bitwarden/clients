import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import {
  WELCOME_EXTENSION_DIALOG_DISMISSED,
  WebVaultExtensionPromptDialogComponent,
} from "../components/web-vault-extension-prompt/web-vault-extension-prompt-dialog.component";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";

@Injectable({ providedIn: "root" })
export class WebVaultExtensionPromptService {
  private stateProvider = inject(StateProvider);
  private webBrowserInteractionService = inject(WebBrowserInteractionService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);

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
      this.stateProvider
        .getUser(userId, WELCOME_EXTENSION_DIALOG_DISMISSED)
        .state$.pipe(map((dismissed) => dismissed ?? false)),
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

  private async profileIsWithinThresholds() {
    const creationDate = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((account) => account?.creationDate ?? new Date()),
      ),
    );

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
