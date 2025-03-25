import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { DesktopPremiumUpgradePromptService } from "./desktop-premium-upgrade-prompt.service";

describe("DesktopPremiumUpgradePromptService", () => {
  let service: DesktopPremiumUpgradePromptService;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    await TestBed.configureTestingModule({
      providers: [DesktopPremiumUpgradePromptService, { provide: Router, useValue: router }],
    }).compileComponents();

    service = TestBed.inject(DesktopPremiumUpgradePromptService);
  });

  describe("promptForPremium", () => {
    it("navigates to the premium update screen", async () => {
      await service.promptForPremium();
      expect(router.navigate).toHaveBeenCalledWith(["/premium"]);
    });
  });
});
