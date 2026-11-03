import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { POPUP_ROUTE_HISTORY_KEY } from "../../../../platform/services/popup-view-cache-background.service";

import {
  ImportConfirmationState,
  ImportConfirmationStateService,
  PENDING_CONFIRMATION,
} from "./import-confirmation-state.service";

describe("ImportConfirmationStateService", () => {
  const userA = "user-a" as UserId;
  const userB = "user-b" as UserId;
  const result: ImportConfirmationState = {
    summary: { total: 3, rows: [{ icon: "globe", labelKey: "typeLogin", count: 3 }] },
    importedFile: { name: "jane-doe-passwords.csv" },
  };

  let service: ImportConfirmationStateService;
  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userA));
    TestBed.configureTestingModule({
      providers: [{ provide: StateProvider, useValue: stateProvider }],
    });
    service = TestBed.inject(ImportConfirmationStateService);
  });

  it("has nothing for this tab or the popup to start with", async () => {
    expect(service.current()).toBeUndefined();
    expect(await firstValueFrom(service.pending$(userA))).toBeNull();
  });

  it("keeps a result for this tab and for the user who imported", async () => {
    await service.set(result, userA);

    expect(service.current()).toEqual(result);
    expect(await firstValueFrom(service.pending$(userA))).toEqual(result);
  });

  it("never shows one user's result to another", async () => {
    await service.set(result, userA);

    expect(await firstValueFrom(service.pending$(userB))).toBeNull();
  });

  it("drops only this tab's copy on clear, so the popup still has its result to show", async () => {
    await service.set(result, userA);

    service.clear();

    expect(service.current()).toBeUndefined();
    expect(await firstValueFrom(service.pending$(userA))).toEqual(result);
  });

  it("drops the user's copy on clearPending, and leaves this tab's and other users'", async () => {
    await service.set(result, userA);
    await service.set({ summary: { total: 9, rows: [] } }, userB);

    await service.clearPending(userA);

    expect(await firstValueFrom(service.pending$(userA))).toBeNull();
    expect((await firstValueFrom(service.pending$(userB)))?.summary.total).toBe(9);
    expect(service.current()?.summary.total).toBe(9);
  });

  it("forgets the popup's last page, so it reopens on the vault, and nothing else", async () => {
    const history = stateProvider.getGlobal(POPUP_ROUTE_HISTORY_KEY);
    await history.update(() => [{ url: "/vault-settings" }]);
    await service.set(result, userA);

    await service.resetPopupHistory();

    expect(await firstValueFrom(history.state$)).toEqual([]);
    expect(await firstValueFrom(service.pending$(userA))).toEqual(result);
  });

  // Running the lock and logout events is the state library's job; this pins what is declared.
  it("declares that the user's result is cleared when they lock or log out", () => {
    expect(PENDING_CONFIRMATION.clearOn).toEqual(["lock", "logout"]);
  });
});
