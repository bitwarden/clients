import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import {
  VaultWelcomeDialogComponent,
  VaultWelcomeDialogResult,
} from "./vault-welcome-dialog.component";

describe("VaultWelcomeDialogComponent", () => {
  let component: VaultWelcomeDialogComponent;
  let fixture: ComponentFixture<VaultWelcomeDialogComponent>;

  const mockUserId = "user-123" as UserId;
  const activeAccount$ = new BehaviorSubject<Account | null>({
    id: mockUserId,
  } as Account);
  const setUserState = jest.fn().mockResolvedValue([mockUserId, true]);
  const close = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [VaultWelcomeDialogComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: StateProvider, useValue: { setUserState } },
        { provide: DialogRef, useValue: { close } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultWelcomeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("onDismiss", () => {
    it("should set acknowledged state and close with Dismissed result", async () => {
      await component["onDismiss"]();

      expect(setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "vaultWelcomeDialogAcknowledged" }),
        true,
        mockUserId,
      );
      expect(close).toHaveBeenCalledWith(VaultWelcomeDialogResult.Dismissed);
    });

    it("should throw if no active account", async () => {
      activeAccount$.next(null);

      await expect(component["onDismiss"]()).rejects.toThrow("Null or undefined account");

      expect(setUserState).not.toHaveBeenCalled();
    });
  });

  describe("onPrimaryCta", () => {
    it("should set acknowledged state and close with GetStarted result", async () => {
      activeAccount$.next({ id: mockUserId } as Account);

      await component["onPrimaryCta"]();

      expect(setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "vaultWelcomeDialogAcknowledged" }),
        true,
        mockUserId,
      );
      expect(close).toHaveBeenCalledWith(VaultWelcomeDialogResult.GetStarted);
    });

    it("should throw if no active account", async () => {
      activeAccount$.next(null);

      await expect(component["onPrimaryCta"]()).rejects.toThrow("Null or undefined account");

      expect(setUserState).not.toHaveBeenCalled();
    });
  });
});
