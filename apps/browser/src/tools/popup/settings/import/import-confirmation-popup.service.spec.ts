import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { DialogService } from "@bitwarden/components";
import { ImportConfirmationDialogComponent } from "@bitwarden/importer-ui";
import { GlobalStateProvider } from "@bitwarden/state";

import { ImportConfirmationPopupService } from "./import-confirmation-popup.service";
import { ImportConfirmationStateService } from "./import-confirmation-state.service";

describe("ImportConfirmationPopupService", () => {
  let service: ImportConfirmationPopupService;
  let state: ImportConfirmationStateService;
  let dialogService: MockProxy<DialogService>;

  beforeEach(() => {
    dialogService = mock<DialogService>();
    TestBed.configureTestingModule({
      providers: [
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: DialogService, useValue: dialogService },
      ],
    });
    state = TestBed.inject(ImportConfirmationStateService);
    service = TestBed.inject(ImportConfirmationPopupService);
  });

  it("opens nothing when no import left a result", async () => {
    await service.conditionallyOpen();

    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("opens the confirmation with the counts and file, which are all the state holds", async () => {
    const summary = { total: 2, rows: [{ icon: "globe", labelKey: "typeLogin", count: 2 }] };
    await state.set({ summary, importedFile: { name: "export.csv" } });

    await service.conditionallyOpen();

    expect(dialogService.open).toHaveBeenCalledWith(ImportConfirmationDialogComponent, {
      data: { summary, importedFile: { name: "export.csv" } },
    });
  });

  it("takes the result, so the next popup open shows nothing", async () => {
    await state.set({ summary: { total: 1, rows: [] } });

    await service.conditionallyOpen();
    await service.conditionallyOpen();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(await firstValueFrom(state.pending$)).toBeNull();
  });
});
