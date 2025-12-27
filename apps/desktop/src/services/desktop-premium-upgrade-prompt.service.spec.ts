import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";

import { PremiumComponent } from "../billing/app/accounts/premium.component";

import { DesktopPremiumUpgradePromptService } from "./desktop-premium-upgrade-prompt.service";

describe("DesktopPremiumUpgradePromptService", () => {
  let service: DesktopPremiumUpgradePromptService;
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;

  beforeEach(async () => {
    configService = mock<ConfigService>();
    dialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      providers: [
        DesktopPremiumUpgradePromptService,
        { provide: ConfigService, useValue: configService },
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

    it("opens the new premium upgrade dialog when feature flag is enabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);

      await service.promptForPremium();

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog,
      );
      expect(openSpy).toHaveBeenCalledWith(dialogService);
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("opens the PremiumComponent when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      await service.promptForPremium();

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog,
      );
      expect(dialogService.open).toHaveBeenCalledWith(PremiumComponent);
      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
