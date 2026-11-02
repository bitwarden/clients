import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ImportedFile } from "../../models";
import { ImportOutcomePresenter } from "../import-confirmation/import-outcome-presenter";

import { FinishedImportOutcome } from "./import-outcome";

/** Syncs the vault, then hands the outcome to the presenter. Shared by credential parsing
 *  (importing straight to the personal vault) and location selection (importing to the location
 *  the user chose). `file` is set when the items came from a file the user picked. */
export async function presentImportOutcome(
  outcome: FinishedImportOutcome,
  services: { syncService: SyncService; logService: LogService; presenter: ImportOutcomePresenter },
  file?: ImportedFile,
): Promise<void> {
  const { syncService, logService, presenter } = services;

  // Before presenting so the caller's spinner covers the wait. Failures are only logged.
  try {
    const synced = await syncService.fullSync(true);
    if (!synced) {
      // An ordinary failure resolves false rather than throwing.
      logService.warning("Post-import sync did not complete");
    }
  } catch (error) {
    logService.error("Post-import sync failed:", error);
  }

  await presenter.present(outcome, file);
}
