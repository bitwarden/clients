import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { RoutedPremiumUpgradePromptService } from "./premium-upgrade-prompt.service";

describe("RoutedPremiumUpgradePromptService", () => {
  let service: RoutedPremiumUpgradePromptService;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    await TestBed.configureTestingModule({
      providers: [RoutedPremiumUpgradePromptService, { provide: Router, useValue: router }],
    }).compileComponents();

    service = TestBed.inject(RoutedPremiumUpgradePromptService);
  });

  describe("promptForPremium", () => {
    it("navigates to the premium update screen", async () => {
      await service.promptForPremium();
      expect(router.navigate).toHaveBeenCalledWith(["/premium"]);
    });
  });
});
