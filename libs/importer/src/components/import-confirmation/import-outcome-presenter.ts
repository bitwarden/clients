import { UserId } from "@bitwarden/common/types/guid";

import { ImportedFile } from "../../models";
import { FinishedImportOutcome } from "../import-controls/import-outcome";
import { ImportReturnDestination } from "../import-return-destination";

export interface ImportOutcomeContext {
  /** The account active when the user pressed Continue. Whoever is active when the import ends may
   *  differ. */
  userId: UserId;
  /** Set when the items came from a file the user picked. */
  file?: ImportedFile;
  /** Set for an organization import started from a page that wants the user sent back to it. */
  returnDestination?: ImportReturnDestination;
}

/** Shows the user the result of an import that has run. The sync after it may have failed. */
export abstract class ImportOutcomePresenter {
  abstract present(
    outcome: FinishedImportOutcome,
    context: ImportOutcomeContext,
  ): void | Promise<void>;
}
