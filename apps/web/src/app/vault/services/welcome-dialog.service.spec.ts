import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import { VaultWelcomeDialogComponent } from "../components/vault-welcome-dialog/vault-welcome-dialog.component";

import { WelcomeDialogService } from "./welcome-dialog.service";

describe("WelcomeDialogService", () => {
  let service: WelcomeDialogService;

  const mockUserId = "user-123" as UserId;

  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const getUserState$ = jest.fn().mockReturnValue(of(false));
  const mockDialogOpen = jest.spyOn(VaultWelcomeDialogComponent, "open");

  let activeAccount$: BehaviorSubject<Account | null>;

  function createAccount(overrides: Partial<Account> = {}): Account {
    return {
      id: mockUserId,
      creationDate: new Date(),
      ...overrides,
    } as Account;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogOpen.mockReset();

    activeAccount$ = new BehaviorSubject<Account | null>(createAccount());

    TestBed.configureTestingModule({
      providers: [
        WelcomeDialogService,
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: DialogService, useValue: {} },
        { provide: StateProvider, useValue: { getUserState$ } },
      ],
    });

    service = TestBed.inject(WelcomeDialogService);
  });

  describe("conditionallyShowWelcomeDialog", () => {
    it("should not show dialog when no active account", async () => {
      activeAccount$.next(null);

      await service.conditionallyShowWelcomeDialog();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when feature flag is disabled", async () => {
      getFeatureFlag.mockResolvedValueOnce(false);

      await service.conditionallyShowWelcomeDialog();

      expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM29437_WelcomeDialog);
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when account has no creation date", async () => {
      activeAccount$.next(createAccount({ creationDate: undefined }));
      getFeatureFlag.mockResolvedValueOnce(true);

      await service.conditionallyShowWelcomeDialog();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when account is older than 30 days", async () => {
      const overThirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 - 1000);
      activeAccount$.next(createAccount({ creationDate: overThirtyDaysAgo }));
      getFeatureFlag.mockResolvedValueOnce(true);

      await service.conditionallyShowWelcomeDialog();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when user has already acknowledged it", async () => {
      activeAccount$.next(createAccount({ creationDate: new Date() }));
      getFeatureFlag.mockResolvedValueOnce(true);
      getUserState$.mockReturnValueOnce(of(true));

      await service.conditionallyShowWelcomeDialog();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should show dialog for new user who has not acknowledged", async () => {
      activeAccount$.next(createAccount({ creationDate: new Date() }));
      getFeatureFlag.mockResolvedValueOnce(true);
      getUserState$.mockReturnValueOnce(of(false));
      mockDialogOpen.mockReturnValue({ closed: of(undefined) } as DialogRef<any>);

      await service.conditionallyShowWelcomeDialog();

      expect(mockDialogOpen).toHaveBeenCalled();
    });

    it("should show dialog for account created 30 days ago", async () => {
      const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 + 1000);
      activeAccount$.next(createAccount({ creationDate: thirtyDaysAgo }));
      getFeatureFlag.mockResolvedValueOnce(true);
      getUserState$.mockReturnValueOnce(of(false));
      mockDialogOpen.mockReturnValue({ closed: of(undefined) } as DialogRef<any>);

      await service.conditionallyShowWelcomeDialog();

      expect(mockDialogOpen).toHaveBeenCalled();
    });
  });
});
