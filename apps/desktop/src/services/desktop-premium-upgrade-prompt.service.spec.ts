import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { DesktopPremiumUpgradePromptService } from "./desktop-premium-upgrade-prompt.service";

describe("DesktopPremiumUpgradePromptService", () => {
  let service: DesktopPremiumUpgradePromptService;
  let messager: MockProxy<MessagingService>;

  beforeEach(async () => {
    messager = mock<MessagingService>();
    await TestBed.configureTestingModule({
      providers: [
        DesktopPremiumUpgradePromptService,
        { provide: MessagingService, useValue: messager },
      ],
    }).compileComponents();

    service = TestBed.inject(DesktopPremiumUpgradePromptService);
  });

  describe("promptForPremium", () => {
    it("navigates to the premium update screen", async () => {
      await service.promptForPremium();
      expect(messager.send).toHaveBeenCalledWith("openPremium");
    });
  });
});
