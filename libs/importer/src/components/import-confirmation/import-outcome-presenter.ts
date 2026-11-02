import { ImportedFile } from "../../models";
import { FinishedImportOutcome } from "../import-controls/import-outcome";

/** Shows the user the result of an import that has run and synced. */
export abstract class ImportOutcomePresenter {
  /** `file` is set when the items came from a file the user picked. */
  abstract present(outcome: FinishedImportOutcome, file?: ImportedFile): void | Promise<void>;
}
