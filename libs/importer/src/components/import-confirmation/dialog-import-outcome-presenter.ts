import { Injectable } from "@angular/core";

import { DialogService } from "@bitwarden/components";

import { ImportedFile } from "../../models";
import { ImportSkippedItemsDialogComponent } from "../dialog";
import { FinishedImportOutcome } from "../import-controls/import-outcome";

import { ImportConfirmationDialogComponent } from "./import-confirmation-dialog.component";
import { ImportOutcomeContext, ImportOutcomePresenter } from "./import-outcome-presenter";
import { summarizeImport } from "./import-summary";

@Injectable()
export class DialogImportOutcomePresenter extends ImportOutcomePresenter {
  constructor(private readonly dialogService: DialogService) {
    super();
  }

  present(outcome: FinishedImportOutcome, { file }: ImportOutcomeContext): void {
    presentInDialog(this.dialogService, outcome, file);
  }
}

/** The skipped-items dialog when items were skipped, otherwise the confirmation dialog. */
export function presentInDialog(
  dialogService: DialogService,
  outcome: FinishedImportOutcome,
  file?: ImportedFile,
): void {
  if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
    dialogService.open(ImportSkippedItemsDialogComponent, {
      data: { errors: outcome.result.errors },
    });
    return;
  }
  dialogService.open(ImportConfirmationDialogComponent, {
    data: { summary: summarizeImport(outcome), importedFile: file },
  });
}
