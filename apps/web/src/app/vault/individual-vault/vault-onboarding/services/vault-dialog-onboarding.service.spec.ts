import { mock, mockReset } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import { VaultWelcomeDialogComponent } from "../../../components/vault-welcome-dialog/vault-welcome-dialog.component";

import { VaultDialogOnboardingService } from "./vault-dialog-onboarding.service";

describe("VaultDialogOnboardingService", () => {
  let sut: VaultDialogOnboardingService;

  const mockAccountService = mock<AccountService>();
  const mockConfigService = mock<ConfigService>();
  const mockStateProvider = mock<StateProvider>();
  const mockDialogService = mock<DialogService>();
  const mockDialogOpen = jest.spyOn(VaultWelcomeDialogComponent, "open");

  const mockUserId = "test-user-id" as UserId;

  function createAccount(overrides: Partial<Account> = {}): Account {
    return {
      id: mockUserId,
      creationDate: new Date(),
      ...overrides,
    } as Account;
  }

  function setupService() {
    sut = new VaultDialogOnboardingService(
      mockAccountService,
      mockConfigService,
      mockStateProvider,
      mockDialogService,
    );
  }

  function mockAcknowledgedState(acknowledged: boolean) {
    mockStateProvider.getUserState$.mockReturnValue(of(acknowledged));
  }

  function mockDialogRef() {
    const dialogRef = { closed: of(undefined) } as DialogRef<any>;
    mockDialogOpen.mockReturnValue(dialogRef);
    return dialogRef;
  }

  beforeEach(() => {
    mockReset(mockAccountService);
    mockReset(mockConfigService);
    mockReset(mockStateProvider);
    mockReset(mockDialogService);
    mockDialogOpen.mockReset();

    mockStateProvider.setUserState.mockResolvedValue([mockUserId, true]);
  });

  describe("displayWelcomeDialogIfNeeded", () => {
    it("should not show dialog when no active account", async () => {
      mockAccountService.activeAccount$ = of(null);
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when feature flag is disabled", async () => {
      const account = createAccount();
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(false);
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.WelcomeDialog);
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when account has no creation date", async () => {
      const account = createAccount({ creationDate: undefined });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when account is older than 24 hours", async () => {
      const twoDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 48);
      const account = createAccount({ creationDate: twoDaysAgo });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockAcknowledgedState(false);
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when user has already acknowledged it", async () => {
      const justNow = new Date();
      const account = createAccount({ creationDate: justNow });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockAcknowledgedState(true);
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should show dialog for new user (<24h) who has not acknowledged", async () => {
      const justNow = new Date();
      const account = createAccount({ creationDate: justNow });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockAcknowledgedState(false);
      mockDialogRef();
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).toHaveBeenCalledWith(mockDialogService);
    });

    it("should persist acknowledged state after dialog is closed", async () => {
      const justNow = new Date();
      const account = createAccount({ creationDate: justNow });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockAcknowledgedState(false);
      mockDialogRef();
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "vaultWelcomeDialogAcknowledged" }),
        true,
        mockUserId,
      );
    });

    it("should show dialog for account created exactly 24 hours ago", async () => {
      const exactlyOneDayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24);
      const account = createAccount({ creationDate: exactlyOneDayAgo });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockAcknowledgedState(false);
      mockDialogRef();
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).toHaveBeenCalled();
    });

    it("should not show dialog for account created just over 24 hours ago", async () => {
      const justOverOneDayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000);
      const account = createAccount({ creationDate: justOverOneDayAgo });
      mockAccountService.activeAccount$ = of(account);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockAcknowledgedState(false);
      setupService();

      await sut.displayWelcomeDialogIfNeeded();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });
  });
});
