import { Injectable } from "@angular/core";

import { DialogService } from "@bitwarden/components";

import { ImportedFile } from "../../models";
import { ImportSkippedItemsDialogComponent, ImportSuccessDialogComponent } from "../dialog";
import { FinishedImportOutcome } from "../import-controls/import-outcome";
import { ImportReturnDestination } from "../import-return-destination";

import { ImportConfirmationDialogComponent } from "./import-confirmation-dialog.component";
import { ImportOutcomeContext, ImportOutcomePresenter } from "./import-outcome-presenter";
import { summarizeImport } from "./import-summary";

@Injectable()
export class DialogImportOutcomePresenter extends ImportOutcomePresenter {
  constructor(private readonly dialogService: DialogService) {
    super();
  }

  present(outcome: FinishedImportOutcome, { file, returnDestination }: ImportOutcomeContext): void {
    presentInDialog(this.dialogService, outcome, file, returnDestination);
  }
}

/** The skipped-items dialog when items were skipped, otherwise the confirmation dialog. */
export function presentInDialog(
  dialogService: DialogService,
  outcome: FinishedImportOutcome,
  file?: ImportedFile,
  returnDestination?: ImportReturnDestination,
): void {
  if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
    dialogService.open(ImportSkippedItemsDialogComponent, {
      data: { errors: outcome.result.errors, ...returnDestination },
    });
    return;
  }
  // The confirmation dialog has no return button, so an import with a page to return to keeps the
  // success dialog.
  if (returnDestination != null) {
    dialogService.open(ImportSuccessDialogComponent, {
      data: {
        ...(outcome.kind === "imported"
          ? { importResult: outcome.result }
          : { sdkSummary: outcome.sdkSummary }),
        ...returnDestination,
      },
    });
    return;
  }
  dialogService.open(ImportConfirmationDialogComponent, {
    data: { summary: summarizeImport(outcome), importedFile: file },
  });
}
