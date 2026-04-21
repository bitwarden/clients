import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { DialogService } from "@bitwarden/components";

import { DesktopPremiumUpgradePromptService } from "./desktop-premium-upgrade-prompt.service";

describe("DesktopPremiumUpgradePromptService", () => {
  let service: DesktopPremiumUpgradePromptService;
  let dialogService: MockProxy<DialogService>;

  beforeEach(async () => {
    dialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      providers: [
        DesktopPremiumUpgradePromptService,
        { provide: DialogService, useValue: dialogService },
      ],
    }).compileComponents();

    service = TestBed.inject(DesktopPremiumUpgradePromptService);
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
