import { Injectable } from "@angular/core";

import { DialogService } from "@bitwarden/components";
import {
  FinishedImportOutcome,
  ImportOutcomePresenter,
  presentInDialog,
  summarizeImport,
} from "@bitwarden/importer-ui";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";

/** Leaves the result for the confirmation page, which the wrappers navigate to. Skipped items
 *  still open their dialog. */
@Injectable()
export class BrowserImportOutcomePresenter extends ImportOutcomePresenter {
  constructor(
    private readonly dialogService: DialogService,
    private readonly confirmationState: ImportConfirmationStateService,
  ) {
    super();
  }

  present(outcome: FinishedImportOutcome, fileName?: string): void {
    if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
      this.confirmationState.clear();
      presentInDialog(this.dialogService, outcome, fileName);
      return;
    }
    this.confirmationState.set({ summary: summarizeImport(outcome), fileName });
  }
}
