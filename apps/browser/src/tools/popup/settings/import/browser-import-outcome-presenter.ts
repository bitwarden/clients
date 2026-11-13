import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import {
  FinishedImportOutcome,
  ImportOutcomeContext,
  ImportOutcomePresenter,
  presentInDialog,
  summarizeImport,
} from "@bitwarden/importer-ui";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";

/** Leaves the result for the confirmation page, which the wrappers navigate to, and for the popup.
 *  Skipped items still open their dialog. */
@Injectable()
export class BrowserImportOutcomePresenter extends ImportOutcomePresenter {
  private readonly dialogService = inject(DialogService);
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);

  async present(outcome: FinishedImportOutcome, { userId, file }: ImportOutcomeContext) {
    // Dropped first so an earlier import's result can't send the tab to a page with nothing to show.
    this.confirmationState.clear();

    // Nothing is shown or kept if the user locked or logged out, or the account changed, since the
    // import started: a dialog would open over the lock screen or for someone else, and the items
    // may have gone to the other account.
    const stillTheirs = (await this.isUnlocked(userId)) && (await this.isActive(userId));

    if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
      await this.confirmationState.clearPending(userId);
      if (stillTheirs) {
        presentInDialog(this.dialogService, outcome, file);
      }
      return;
    }

    if (!stillTheirs) {
      return;
    }
    await this.confirmationState.set(
      { summary: summarizeImport(outcome), importedFile: file },
      userId,
    );
    // Locking or logging out clears a user's state once, so a result written after it would stay.
    if (!(await this.isUnlocked(userId))) {
      this.confirmationState.clear();
      await this.confirmationState.clearPending(userId);
    }
  }

  private async isUnlocked(userId: UserId): Promise<boolean> {
    const status = await firstValueFrom(this.authService.authStatusFor$(userId));
    return status === AuthenticationStatus.Unlocked;
  }

  private async isActive(userId: UserId): Promise<boolean> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    return account?.id === userId;
  }
}
