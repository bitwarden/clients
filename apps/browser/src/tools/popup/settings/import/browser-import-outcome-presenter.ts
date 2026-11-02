import { Injectable } from "@angular/core";

import { DialogService } from "@bitwarden/components";
import { ImportedFile } from "@bitwarden/importer-core";
import {
  FinishedImportOutcome,
  ImportOutcomePresenter,
  presentInDialog,
  summarizeImport,
} from "@bitwarden/importer-ui";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";

/** Leaves the result for the confirmation page, which the wrappers navigate to, and for the popup.
 *  Skipped items still open their dialog. */
@Injectable()
export class BrowserImportOutcomePresenter extends ImportOutcomePresenter {
  constructor(
    private readonly dialogService: DialogService,
    private readonly confirmationState: ImportConfirmationStateService,
  ) {
    super();
  }

  async present(outcome: FinishedImportOutcome, file?: ImportedFile): Promise<void> {
    if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
      this.confirmationState.clear();
      await this.confirmationState.clearPending();
      presentInDialog(this.dialogService, outcome, file);
      return;
    }
    await this.confirmationState.set({ summary: summarizeImport(outcome), importedFile: file });
  }
}
