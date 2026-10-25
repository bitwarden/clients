import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ImportSkippedItemsDialogComponent, ImportSuccessDialogComponent } from "../dialog";

import { FinishedImportOutcome } from "./import-outcome";

/** Syncs the vault, then shows the success or skipped-items dialog. Shared by credential parsing
 *  (importing straight to the personal vault) and location selection (importing to the location
 *  the user chose). */
export async function presentImportOutcome(
  outcome: FinishedImportOutcome,
  services: { syncService: SyncService; logService: LogService; dialogService: DialogService },
): Promise<void> {
  const { syncService, logService, dialogService } = services;

  // Before the dialog so the caller's spinner covers the wait. Failures are only logged.
  try {
    const synced = await syncService.fullSync(true);
    if (!synced) {
      // An ordinary failure resolves false rather than throwing.
      logService.warning("Post-import sync did not complete");
    }
  } catch (error) {
    logService.error("Post-import sync failed:", error);
  }

  if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
    dialogService.open(ImportSkippedItemsDialogComponent, {
      data: { errors: outcome.result.errors },
    });
  } else {
    dialogService.open(ImportSuccessDialogComponent, {
      data:
        outcome.kind === "imported"
          ? { importResult: outcome.result }
          : { sdkSummary: outcome.sdkSummary },
    });
  }
}
