import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { ImportConfirmationDialogComponent } from "@bitwarden/importer-ui";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";

/** Shows the popup the result of an import that finished in a tab. */
@Injectable({ providedIn: "root" })
export class ImportConfirmationPopupService {
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly dialogService = inject(DialogService);

  /** Opens the confirmation if this user's import left one, and takes it so it shows once. Returns
   *  whether it did, so the caller can hold back prompts that would open over it. */
  async conditionallyOpen(userId: UserId): Promise<boolean> {
    const pending = await firstValueFrom(this.confirmationState.pending$(userId));
    if (pending == null) {
      return false;
    }
    await this.confirmationState.clearPending(userId);
    this.dialogService.open(ImportConfirmationDialogComponent, {
      data: { summary: pending.summary, importedFile: pending.importedFile },
    });
    return true;
  }
}
