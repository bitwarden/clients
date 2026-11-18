import { mock } from "jest-mock-extended";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { ImportResult } from "../../models";
import { ImportSkippedItemsDialogComponent, ImportSuccessDialogComponent } from "../dialog";

import { DialogImportOutcomePresenter } from "./dialog-import-outcome-presenter";
import { ImportConfirmationDialogComponent } from "./import-confirmation-dialog.component";

describe("DialogImportOutcomePresenter", () => {
  const userId = "user-1" as UserId;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let presenter: DialogImportOutcomePresenter;

  const resultWith = (errors: ImportResult["errors"] = []) => {
    const result = new ImportResult();
    result.ciphers = [Object.assign(new CipherView(), { type: CipherType.Login, name: "secret" })];
    result.errors = errors;
    return result;
  };

  beforeEach(() => {
    dialogService = mock<DialogService>();
    presenter = new DialogImportOutcomePresenter(dialogService);
  });

  it("gives the confirmation dialog the counts and file name, not the imported items", () => {
    const result = resultWith();

    presenter.present({ kind: "imported", result }, { userId, file: { name: "export.csv" } });

    const [component, config] = dialogService.open.mock.calls[0] as [unknown, { data: unknown }];
    expect(component).toBe(ImportConfirmationDialogComponent);
    expect(config.data).toEqual({
      summary: { total: 1, rows: [{ icon: "globe", labelKey: "typeLogin", count: 1 }] },
      importedFile: { name: "export.csv" },
    });
    expect(JSON.stringify(config.data)).not.toContain("secret");
  });

  it("opens the skipped-items dialog when items were skipped", () => {
    const errors = [{ message: "bad item" }] as unknown as ImportResult["errors"];

    presenter.present({ kind: "imported", result: resultWith(errors) }, { userId });

    expect(dialogService.open).toHaveBeenCalledWith(
      ImportSkippedItemsDialogComponent,
      expect.objectContaining({ data: { errors } }),
    );
  });

  describe("with a page to return to", () => {
    const returnDestination = {
      returnUrl: "/organizations/org-1/access-intelligence",
      returnLabel: "Go",
    };

    it("keeps the success dialog, which has the return button, instead of the confirmation dialog", () => {
      const result = resultWith();

      presenter.present({ kind: "imported", result }, { userId, returnDestination });

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportSuccessDialogComponent,
        expect.objectContaining({ data: { importResult: result, ...returnDestination } }),
      );
    });

    it("keeps the success dialog for an SDK import too", () => {
      const sdkSummary = { total: 3 } as never;

      presenter.present({ kind: "importedWithSdk", sdkSummary }, { userId, returnDestination });

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportSuccessDialogComponent,
        expect.objectContaining({ data: { sdkSummary, ...returnDestination } }),
      );
    });

    it("gives the skipped-items dialog the return button as well", () => {
      const errors = [{ message: "bad item" }] as unknown as ImportResult["errors"];

      presenter.present(
        { kind: "imported", result: resultWith(errors) },
        { userId, returnDestination },
      );

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportSkippedItemsDialogComponent,
        expect.objectContaining({ data: { errors, ...returnDestination } }),
      );
    });
  });
});
