import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { DialogService } from "@bitwarden/components";

import { BrowserPremiumUpgradePromptService } from "./browser-premium-upgrade-prompt.service";

describe("BrowserPremiumUpgradePromptService", () => {
  let service: BrowserPremiumUpgradePromptService;
  let dialogService: MockProxy<DialogService>;

  beforeEach(async () => {
    dialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      providers: [
        BrowserPremiumUpgradePromptService,
        { provide: DialogService, useValue: dialogService },
      ],
    }).compileComponents();

    service = TestBed.inject(BrowserPremiumUpgradePromptService);
  });

  describe("promptForPremium", () => {
    let openSpy: jest.SpyInstance;

    beforeEach(() => {
      openSpy = jest.spyOn(PremiumUpgradeDialogComponent, "open").mockImplementation();
    });

    afterEach(() => {
      openSpy.mockRestore();
    });

    it("opens the premium upgrade dialog", async () => {
      await service.promptForPremium();

      expect(openSpy).toHaveBeenCalledWith(dialogService);
    });
  });
});
