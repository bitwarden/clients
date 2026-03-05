import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";

import { BrowserPremiumUpgradePromptService } from "./browser-premium-upgrade-prompt.service";

describe("BrowserPremiumUpgradePromptService", () => {
  let service: BrowserPremiumUpgradePromptService;
  let router: MockProxy<Router>;
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;

  beforeEach(async () => {
    router = mock<Router>();
    configService = mock<ConfigService>();
    dialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      providers: [
        BrowserPremiumUpgradePromptService,
        { provide: Router, useValue: router },
        { provide: ConfigService, useValue: configService },
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

    it("opens the new premium upgrade dialog when feature flag is enabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);

      await service.promptForPremium();

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog,
      );
      expect(openSpy).toHaveBeenCalledWith(dialogService);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("navigates to the premium update screen when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      await service.promptForPremium();

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog,
      );
      expect(router.navigate).toHaveBeenCalledWith(["/premium"]);
      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
