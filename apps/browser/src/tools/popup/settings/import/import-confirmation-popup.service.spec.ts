import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { ImportConfirmationDialogComponent } from "@bitwarden/importer-ui";
import { StateProvider } from "@bitwarden/state";

import { ImportConfirmationPopupService } from "./import-confirmation-popup.service";
import { ImportConfirmationStateService } from "./import-confirmation-state.service";

describe("ImportConfirmationPopupService", () => {
  const userA = "user-a" as UserId;
  const userB = "user-b" as UserId;

  let service: ImportConfirmationPopupService;
  let state: ImportConfirmationStateService;
  let dialogService: MockProxy<DialogService>;

  beforeEach(() => {
    dialogService = mock<DialogService>();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StateProvider,
          useValue: new FakeStateProvider(mockAccountServiceWith(userA)),
        },
        { provide: DialogService, useValue: dialogService },
      ],
    });
    state = TestBed.inject(ImportConfirmationStateService);
    service = TestBed.inject(ImportConfirmationPopupService);
  });

  it("opens nothing when no import left a result", async () => {
    await service.conditionallyOpen(userA);

    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("opens the confirmation with the counts and file, which are all the state holds", async () => {
    const summary = { total: 2, rows: [{ icon: "globe", labelKey: "typeLogin", count: 2 }] };
    await state.set({ summary, importedFile: { name: "export.csv" } }, userA);

    await service.conditionallyOpen(userA);

    expect(dialogService.open).toHaveBeenCalledWith(ImportConfirmationDialogComponent, {
      data: { summary, importedFile: { name: "export.csv" } },
    });
  });

  it("takes the result, so the next popup open shows nothing", async () => {
    await state.set({ summary: { total: 1, rows: [] } }, userA);

    await service.conditionallyOpen(userA);
    await service.conditionallyOpen(userA);

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(await firstValueFrom(state.pending$(userA))).toBeNull();
  });

  it("says it opened the confirmation, so the caller can hold back prompts that would open over it", async () => {
    await state.set({ summary: { total: 1, rows: [] } }, userA);

    expect(await service.conditionallyOpen(userA)).toBe(true);
  });

  it("says it opened nothing when there is no result, or it is another user's", async () => {
    expect(await service.conditionallyOpen(userA)).toBe(false);

    await state.set({ summary: { total: 1, rows: [] } }, userA);
    expect(await service.conditionallyOpen(userB)).toBe(false);
  });

  it("does not show one user's result when another user's popup opens, and keeps it for them", async () => {
    await state.set({ summary: { total: 1, rows: [] } }, userA);

    await service.conditionallyOpen(userB);

    expect(dialogService.open).not.toHaveBeenCalled();
    expect(await firstValueFrom(state.pending$(userA))).not.toBeNull();
  });
});
