import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  ACCESS_INTELLIGENCE_WELCOME_DIALOG_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";

const ACCESS_INTELLIGENCE_POST_IMPORT_DIALOG_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  ACCESS_INTELLIGENCE_WELCOME_DIALOG_DISK,
  "accessIntelligencePostImportDialogCompleted",
  {
    deserializer: (value) => value,
    clearOn: [], // Post-import dialog acknowledged state should persist across lock/logout so the dialog is not reshown
  },
);

const ACCESS_INTELLIGENCE_NEW_ADMIN_WELCOME_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  ACCESS_INTELLIGENCE_WELCOME_DIALOG_DISK,
  "accessIntelligenceNewAdminWelcomeAcknowledged",
  {
    deserializer: (value) => value,
    clearOn: [], // New admin welcome acknowledged state should persist across lock/logout so the tour is not reshown
  },
);

const AI_COACHMARK_TOUR_COMPLETED_KEY = new UserKeyDefinition<boolean>(
  ACCESS_INTELLIGENCE_WELCOME_DIALOG_DISK,
  "aiCoachmarkTourCompleted",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);

@Injectable()
export class OnboardingService {
  private accountService = inject(AccountService);
  private stateProvider = inject(StateProvider);

  async isPostImportDialogAcknowledged(): Promise<boolean> {
    return this.isAcknowledged(ACCESS_INTELLIGENCE_POST_IMPORT_DIALOG_ACKNOWLEDGED_KEY);
  }

  async setPostImportDialogAcknowledged(value = true) {
    await this.setAcknowledged(ACCESS_INTELLIGENCE_POST_IMPORT_DIALOG_ACKNOWLEDGED_KEY, value);
  }

  async isNewAdminWelcomeDialogAcknowledged(): Promise<boolean> {
    return this.isAcknowledged(ACCESS_INTELLIGENCE_NEW_ADMIN_WELCOME_ACKNOWLEDGED_KEY);
  }

  async setNewAdminWelcomeDialogAcknowledged(value = true) {
    await this.setAcknowledged(ACCESS_INTELLIGENCE_NEW_ADMIN_WELCOME_ACKNOWLEDGED_KEY, value);
  }

  async isAICoachmarkTourCompleted(): Promise<boolean> {
    return this.isAcknowledged(AI_COACHMARK_TOUR_COMPLETED_KEY);
  }

  async setAICoachmarkTourCompleted(value = true): Promise<void> {
    await this.setAcknowledged(AI_COACHMARK_TOUR_COMPLETED_KEY, value);
  }

  private async isAcknowledged(key: UserKeyDefinition<boolean>): Promise<boolean> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return false;
    }

    return await firstValueFrom(
      this.stateProvider.getUserState$(key, account.id).pipe(map((v) => v ?? false)),
    );
  }

  private async setAcknowledged(key: UserKeyDefinition<boolean>, value = true) {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      await this.stateProvider.setUserState(key, value, account.id);
    }
  }
}
