import { FinishedImportOutcome } from "../import-controls/import-outcome";

/** Shows the user the result of an import that has run and synced. */
export abstract class ImportOutcomePresenter {
  /** `fileName` is the file the items came from, if the user picked one. */
  abstract present(outcome: FinishedImportOutcome, fileName?: string): void | Promise<void>;
}
