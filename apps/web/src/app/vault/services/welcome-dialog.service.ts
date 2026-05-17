import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";

import { VaultWelcomeDialogComponent } from "../components/vault-welcome-dialog/vault-welcome-dialog.component";

const VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "vaultWelcomeDialogAcknowledged",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

const THIRTY_DAY_MS = 1000 * 60 * 60 * 24 * 30;

@Injectable({ providedIn: "root" })
export class WelcomeDialogService {
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);
  private stateProvider = inject(StateProvider);

  /**
   * Conditionally shows the welcome dialog to new users.
   *
   * @returns true if the dialog was shown, false otherwise
   */
  async conditionallyShowWelcomeDialog() {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    const enabled = await this.configService.getFeatureFlag(FeatureFlag.PM29437_WelcomeDialog);
    if (!enabled) {
      return;
    }

    const createdAt = account.creationDate;
    if (!createdAt) {
      return;
    }

    const ageMs = Date.now() - createdAt.getTime();
    const isNewUser = ageMs >= 0 && ageMs <= THIRTY_DAY_MS;
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

    const dialogRef = VaultWelcomeDialogComponent.open(this.dialogService);
    await firstValueFrom(dialogRef.closed);

    return;
  }
}
