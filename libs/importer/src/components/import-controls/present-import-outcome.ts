import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import {
  ImportOutcomeContext,
  ImportOutcomePresenter,
} from "../import-confirmation/import-outcome-presenter";

import { FinishedImportOutcome } from "./import-outcome";

/** Syncs the vault, then hands the outcome to the presenter. Shared by credential parsing
 *  (importing straight to the personal vault) and location selection (importing to the location
 *  the user chose). */
export async function presentImportOutcome(
  outcome: FinishedImportOutcome,
  services: { syncService: SyncService; logService: LogService; presenter: ImportOutcomePresenter },
  context: ImportOutcomeContext,
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

  // The items are in the vault by now, so a result that fails to show must not leave the user
  // facing a form that would import them again. Name only: the error can carry file or item names.
  try {
    await presenter.present(outcome, context);
  } catch (error) {
    logService.error("Showing the import result failed:", error instanceof Error ? error.name : "");
  }
}
