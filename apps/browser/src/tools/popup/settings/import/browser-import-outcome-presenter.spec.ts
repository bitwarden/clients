import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { ImportResult } from "@bitwarden/importer-core";
import { ImportSkippedItemsDialogComponent } from "@bitwarden/importer-ui";
import { StateProvider } from "@bitwarden/state";

import { BrowserImportOutcomePresenter } from "./browser-import-outcome-presenter";
import { ImportConfirmationStateService } from "./import-confirmation-state.service";

describe("BrowserImportOutcomePresenter", () => {
  const userId = "user-a" as UserId;
  const otherUserId = "user-b" as UserId;

  let dialogService: ReturnType<typeof mock<DialogService>>;
  let authService: MockProxy<AuthService>;
  let activeAccount$: BehaviorSubject<Account | null>;
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
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as unknown as Account);
    TestBed.configureTestingModule({
      providers: [
        BrowserImportOutcomePresenter,
        { provide: DialogService, useValue: dialogService },
        { provide: AuthService, useValue: authService },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: StateProvider,
          useValue: new FakeStateProvider(mockAccountServiceWith(userId)),
        },
      ],
    });
    confirmationState = TestBed.inject(ImportConfirmationStateService);
    presenter = TestBed.inject(BrowserImportOutcomePresenter);
  });

  it("keeps only the counts and file for the confirmation page and the popup", async () => {
    await presenter.present(
      { kind: "imported", result: resultWith() },
      { userId, file: { name: "export.csv" } },
    );

    const expected = {
      summary: { total: 1, rows: [{ icon: "globe", labelKey: "typeLogin", count: 1 }] },
      importedFile: { name: "export.csv" },
    };
    expect(confirmationState.current()).toEqual(expected);
    expect(await firstValueFrom(confirmationState.pending$(userId))).toEqual(expected);
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("saves nothing when the account changed during the import, as the items may have gone to the other one", async () => {
    activeAccount$.next({ id: otherUserId } as unknown as Account);

    await presenter.present({ kind: "imported", result: resultWith() }, { userId });

    expect(await firstValueFrom(confirmationState.pending$(userId))).toBeNull();
    expect(await firstValueFrom(confirmationState.pending$(otherUserId))).toBeNull();
    expect(confirmationState.current()).toBeUndefined();
  });

  it.each([AuthenticationStatus.LoggedOut, AuthenticationStatus.Locked])(
    "saves nothing for a user who is %s",
    async (status) => {
      authService.authStatusFor$.mockReturnValue(of(status));

      await presenter.present({ kind: "imported", result: resultWith() }, { userId });

      expect(await firstValueFrom(confirmationState.pending$(userId))).toBeNull();
      expect(confirmationState.current()).toBeUndefined();
    },
  );

  describe("when items were skipped", () => {
    const errors = [{ message: "bad item" }] as unknown as ImportResult["errors"];
    const skipped = () => ({ kind: "imported" as const, result: resultWith(errors) });

    it("opens no dialog over the lock screen for a user who locked during the import", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await presenter.present(skipped(), { userId });

      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("opens no dialog for another user when the account changed during the import", async () => {
      activeAccount$.next({ id: otherUserId } as unknown as Account);

      await presenter.present(skipped(), { userId });

      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("still drops the user's earlier result when it opens no dialog", async () => {
      await confirmationState.set({ summary: { total: 9, rows: [] } }, userId);
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await presenter.present(skipped(), { userId });

      expect(await firstValueFrom(confirmationState.pending$(userId))).toBeNull();
      expect(confirmationState.current()).toBeUndefined();
    });
  });

  it("takes back a result written just as the user locked, since their lock already cleared state", async () => {
    authService.authStatusFor$
      .mockReturnValueOnce(of(AuthenticationStatus.Unlocked))
      .mockReturnValue(of(AuthenticationStatus.Locked));

    await presenter.present({ kind: "imported", result: resultWith() }, { userId });

    expect(await firstValueFrom(confirmationState.pending$(userId))).toBeNull();
    expect(confirmationState.current()).toBeUndefined();
  });

  it("drops an earlier import's result from the tab when it saves nothing, so Continue can't open a page with nothing to show", async () => {
    await confirmationState.set({ summary: { total: 9, rows: [] } }, userId);
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

    await presenter.present({ kind: "imported", result: resultWith() }, { userId });

    expect(confirmationState.current()).toBeUndefined();
  });

  it("keeps the counts of an SDK import", async () => {
    await presenter.present(
      {
        kind: "importedWithSdk",
        sdkSummary: { ciphers: [{ type: CipherType.Card, count: 2 }], folders: 0, collections: 0 },
      },
      { userId },
    );

    expect(confirmationState.current()?.summary.total).toBe(2);
    expect(confirmationState.current()?.importedFile).toBeUndefined();
  });

  it("opens the skipped-items dialog instead, and drops the user's earlier result", async () => {
    await confirmationState.set({ summary: { total: 9, rows: [] } }, userId);
    const errors = [{ message: "bad item" }] as unknown as ImportResult["errors"];

    await presenter.present({ kind: "imported", result: resultWith(errors) }, { userId });

    expect(dialogService.open).toHaveBeenCalledWith(
      ImportSkippedItemsDialogComponent,
      expect.objectContaining({ data: { errors } }),
    );
    expect(confirmationState.current()).toBeUndefined();
    expect(await firstValueFrom(confirmationState.pending$(userId))).toBeNull();
  });
});
