import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { ImportConfirmationDialogComponent } from "@bitwarden/importer-ui";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";

/** Shows the popup the result of an import that finished in a tab. */
@Injectable({ providedIn: "root" })
export class ImportConfirmationPopupService {
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly dialogService = inject(DialogService);

  /** Opens the confirmation if an import left one, and takes it so it shows once. */
  async conditionallyOpen(): Promise<void> {
    const pending = await firstValueFrom(this.confirmationState.pending$);
    if (pending == null) {
      return;
    }
    await this.confirmationState.clearPending();
    this.dialogService.open(ImportConfirmationDialogComponent, {
      data: { summary: pending.summary, importedFile: pending.importedFile },
    });
  }
}
