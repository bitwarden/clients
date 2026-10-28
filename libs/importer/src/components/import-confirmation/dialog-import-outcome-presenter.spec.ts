import { mock } from "jest-mock-extended";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { ImportResult } from "../../models";
import { ImportSkippedItemsDialogComponent } from "../dialog";

import { DialogImportOutcomePresenter } from "./dialog-import-outcome-presenter";
import { ImportConfirmationDialogComponent } from "./import-confirmation-dialog.component";

describe("DialogImportOutcomePresenter", () => {
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

    presenter.present({ kind: "imported", result }, "export.csv");

    const [component, config] = dialogService.open.mock.calls[0] as [unknown, { data: unknown }];
    expect(component).toBe(ImportConfirmationDialogComponent);
    expect(config.data).toEqual({
      summary: { total: 1, rows: [{ icon: "globe", labelKey: "typeLogin", count: 1 }] },
      fileName: "export.csv",
    });
    expect(JSON.stringify(config.data)).not.toContain("secret");
  });

  it("opens the skipped-items dialog when items were skipped", () => {
    const errors = [{ message: "bad item" }] as unknown as ImportResult["errors"];

    presenter.present({ kind: "imported", result: resultWith(errors) });

    expect(dialogService.open).toHaveBeenCalledWith(
      ImportSkippedItemsDialogComponent,
      expect.objectContaining({ data: { errors } }),
    );
  });
});
