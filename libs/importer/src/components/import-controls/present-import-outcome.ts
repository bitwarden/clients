import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ImportOutcomePresenter } from "../import-confirmation/import-outcome-presenter";

import { FinishedImportOutcome } from "./import-outcome";

/** Syncs the vault, then hands the outcome to the presenter. Shared by credential parsing
 *  (importing straight to the personal vault) and location selection (importing to the location
 *  the user chose). `fileName` is the file the items came from, if the user picked one. */
export async function presentImportOutcome(
  outcome: FinishedImportOutcome,
  services: { syncService: SyncService; logService: LogService; presenter: ImportOutcomePresenter },
  fileName?: string,
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

  await presenter.present(outcome, fileName);
}
