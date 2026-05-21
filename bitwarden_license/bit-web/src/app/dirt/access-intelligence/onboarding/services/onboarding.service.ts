import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  ACCESS_INTELLIGENCE_WELCOME_DIALOG_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";

const ACCESS_INTELLIGENCE_WELCOME_DIALOG_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  ACCESS_INTELLIGENCE_WELCOME_DIALOG_DISK,
  "accessIntelligenceWelcomeDialogCompleted",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

@Injectable()
export class OnboardingService {
  private accountService = inject(AccountService);
  private stateProvider = inject(StateProvider);

  async isWelcomeDialogAcknowledged(): Promise<boolean> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return false;
    }

    const acknowledged = await firstValueFrom(
      this.stateProvider
        .getUserState$(ACCESS_INTELLIGENCE_WELCOME_DIALOG_ACKNOWLEDGED_KEY, account.id)
        .pipe(map((v) => v ?? false)),
    );

    return acknowledged;
  }

  async setWelcomeDialogAcknowledged(value = true) {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      await this.stateProvider.setUserState(
        ACCESS_INTELLIGENCE_WELCOME_DIALOG_ACKNOWLEDGED_KEY,
        value,
        account.id,
      );
    }
  }
}
