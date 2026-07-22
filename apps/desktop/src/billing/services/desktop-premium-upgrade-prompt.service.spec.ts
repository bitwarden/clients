import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { PremiumComponent } from "../app/accounts/premium.component";

import { DesktopPremiumUpgradePromptService } from "./desktop-premium-upgrade-prompt.service";

describe("DesktopPremiumUpgradePromptService", () => {
  let service: DesktopPremiumUpgradePromptService;
  let dialogService: MockProxy<DialogService>;
  let accountService: MockProxy<AccountService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let logService: MockProxy<LogService>;

  const account = { id: "test-user-id" as UserId } as Account;

  beforeEach(async () => {
    dialogService = mock<DialogService>();
    accountService = mock<AccountService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    logService = mock<LogService>();

    await TestBed.configureTestingModule({
      providers: [
        DesktopPremiumUpgradePromptService,
        { provide: DialogService, useValue: dialogService },
        { provide: AccountService, useValue: accountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: LogService, useValue: logService },
      ],
    }).compileComponents();

    service = TestBed.inject(DesktopPremiumUpgradePromptService);
  });

  describe("promptForPremium", () => {
    let upgradeOpenSpy: jest.SpyInstance;

    beforeEach(() => {
      upgradeOpenSpy = jest.spyOn(PremiumUpgradeDialogComponent, "open").mockImplementation();
      accountService.activeAccount$ = of(account);
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    });

    afterEach(() => {
      upgradeOpenSpy.mockRestore();
    });

    it("opens the premium upgrade dialog when the user does not have premium", async () => {
      await service.promptForPremium();

      expect(upgradeOpenSpy).toHaveBeenCalledWith(dialogService);
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("opens the premium membership component when the user already has premium", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

      await service.promptForPremium();

      expect(dialogService.open).toHaveBeenCalledWith(PremiumComponent);
      expect(upgradeOpenSpy).not.toHaveBeenCalled();
    });

    it("checks premium status for the active account", async () => {
      await service.promptForPremium();

      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
        account.id,
      );
    });

    it("does nothing but logs a warning when there is no active account", async () => {
      accountService.activeAccount$ = of(null);

      await service.promptForPremium();

      expect(upgradeOpenSpy).not.toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).not.toHaveBeenCalled();
      expect(logService.warning).toHaveBeenCalled();
    });

    it("logs instead of rejecting when the premium status read errors", async () => {
      const error = new Error("storage read failed");
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
        throwError(() => error),
      );

      await expect(service.promptForPremium()).resolves.toBeUndefined();

      expect(logService.error).toHaveBeenCalledWith(expect.any(String), error);
      expect(upgradeOpenSpy).not.toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
    });
  });
});
