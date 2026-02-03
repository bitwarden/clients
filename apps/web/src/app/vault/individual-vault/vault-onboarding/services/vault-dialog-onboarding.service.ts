import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { map } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";

import { CoachmarkService } from "../../../components/coachmark";
import {
  VaultWelcomeDialogComponent,
  VaultWelcomeDialogResult,
} from "../../../components/vault-welcome-dialog/vault-welcome-dialog.component";

const VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "vaultWelcomeDialogAcknowledged",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

@Injectable({
  providedIn: "root",
})
export class VaultDialogOnboardingService {
  constructor(
    private accountService: AccountService,
    private configService: ConfigService,
    private stateProvider: StateProvider,
    private dialogService: DialogService,
    private coachmarkService: CoachmarkService,
  ) {}

  async displayWelcomeDialogIfNeeded(): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    // // Must first check the feature flag.
    const enabled = await this.configService.getFeatureFlag(FeatureFlag.WelcomeDialog);
    if (!enabled) {
      return;
    }

    const createdAt = account.creationDate;
    if (!createdAt) {
      return;
    }

    const ageMs = Date.now() - createdAt.getTime();
    const isNewUser = ageMs >= 0 && ageMs <= ONE_DAY_MS;
    if (!isNewUser) {
      return;
    }

    const acknowledged = await firstValueFrom(
      this.stateProvider
        .getUserState$(VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY, account.id)
        .pipe(map((v) => v ?? false)),
    );

    if (acknowledged) {
      return;
    }

    const dialogRef = VaultWelcomeDialogComponent.open(this.dialogService, {
      data: { showTourCta: true },
    });
    const result = await firstValueFrom(dialogRef.closed);

    await this.stateProvider.setUserState(VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY, true, account.id);

    // Start the coachmark tour if user clicked the primary CTA ("Get Started")
    if (result === VaultWelcomeDialogResult.GetStarted) {
      // Small delay to allow the dialog to close and DOM to stabilize
      setTimeout(() => {
        void this.coachmarkService.startTour();
      }, 100);
    }
  }
}
