import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { ImportResult } from "@bitwarden/importer-core";
import { ImportSkippedItemsDialogComponent } from "@bitwarden/importer-ui";
import { GlobalStateProvider } from "@bitwarden/state";

import { BrowserImportOutcomePresenter } from "./browser-import-outcome-presenter";
import { ImportConfirmationStateService } from "./import-confirmation-state.service";

describe("BrowserImportOutcomePresenter", () => {
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let confirmationState: ImportConfirmationStateService;
  let presenter: BrowserImportOutcomePresenter;

  const resultWith = (errors: ImportResult["errors"] = []) => {
    const result = new ImportResult();
    result.ciphers = [Object.assign(new CipherView(), { type: CipherType.Login })];
    result.errors = errors;
    return result;
  };

  beforeEach(() => {
    dialogService = mock<DialogService>();
    TestBed.configureTestingModule({
      providers: [{ provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() }],
    });
    confirmationState = TestBed.inject(ImportConfirmationStateService);
    presenter = new BrowserImportOutcomePresenter(dialogService, confirmationState);
  });

  it("keeps only the counts and file for the confirmation page and the popup", async () => {
    await presenter.present({ kind: "imported", result: resultWith() }, { name: "export.csv" });

    const expected = {
      summary: { total: 1, rows: [{ icon: "globe", labelKey: "typeLogin", count: 1 }] },
      importedFile: { name: "export.csv" },
    };
    expect(confirmationState.current()).toEqual(expected);
    expect(await firstValueFrom(confirmationState.pending$)).toEqual(expected);
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("keeps the counts of an SDK import", async () => {
    await presenter.present({
      kind: "importedWithSdk",
      sdkSummary: { ciphers: [{ type: CipherType.Card, count: 2 }], folders: 0, collections: 0 },
    });

    expect(confirmationState.current()?.summary.total).toBe(2);
    expect(confirmationState.current()?.importedFile).toBeUndefined();
  });

  it("opens the skipped-items dialog instead, and drops any earlier result", async () => {
    await confirmationState.set({ summary: { total: 9, rows: [] } });
    const errors = [{ message: "bad item" }] as unknown as ImportResult["errors"];

    await presenter.present({ kind: "imported", result: resultWith(errors) });

    expect(dialogService.open).toHaveBeenCalledWith(
      ImportSkippedItemsDialogComponent,
      expect.objectContaining({ data: { errors } }),
    );
    expect(confirmationState.current()).toBeUndefined();
    expect(await firstValueFrom(confirmationState.pending$)).toBeNull();
  });
});
