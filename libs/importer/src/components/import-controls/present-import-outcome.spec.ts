import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ImportResult } from "../../models";
import { ImportOutcomePresenter } from "../import-confirmation/import-outcome-presenter";

import { FinishedImportOutcome } from "./import-outcome";
import { presentImportOutcome } from "./present-import-outcome";

describe("presentImportOutcome", () => {
  const outcome: FinishedImportOutcome = { kind: "imported", result: new ImportResult() };
  const context = { userId: "user-1" as UserId, file: { name: "export.csv" } };

  let syncService: MockProxy<SyncService>;
  let logService: MockProxy<LogService>;
  let presenter: MockProxy<ImportOutcomePresenter>;

  const run = () => presentImportOutcome(outcome, { syncService, logService, presenter }, context);

  beforeEach(() => {
    syncService = mock<SyncService>();
    syncService.fullSync.mockResolvedValue(true);
    logService = mock<LogService>();
    presenter = mock<ImportOutcomePresenter>();
  });

  it("syncs first, then hands the outcome and who ran the import to the presenter", async () => {
    await run();

    expect(syncService.fullSync).toHaveBeenCalledWith(true);
    expect(presenter.present).toHaveBeenCalledWith(outcome, context);
    expect(syncService.fullSync.mock.invocationCallOrder[0]).toBeLessThan(
      presenter.present.mock.invocationCallOrder[0],
    );
  });

  it("still presents when the sync fails, logging it", async () => {
    syncService.fullSync.mockRejectedValue(new Error("offline"));

    await run();

    expect(logService.error).toHaveBeenCalledWith("Post-import sync failed:", expect.any(Error));
    expect(presenter.present).toHaveBeenCalled();
  });

  it("does not throw when the presenter fails, and logs only the error's name", async () => {
    presenter.present.mockRejectedValue(new RangeError("failed for export.csv"));

    await expect(run()).resolves.toBeUndefined();

    expect(logService.error).toHaveBeenCalledWith(
      "Showing the import result failed:",
      "RangeError",
    );
    expect(JSON.stringify(logService.error.mock.calls)).not.toContain("export.csv");
  });
});
