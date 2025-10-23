import { CdkTrapFocus } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { firstValueFrom, of, throwError } from "rxjs";

import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, ToastService } from "@bitwarden/components";

import { PremiumUpgradeDialogComponent } from "./premium-upgrade-dialog.component";

describe("PremiumUpgradeDialogComponent", () => {
  let component: PremiumUpgradeDialogComponent;
  let fixture: ComponentFixture<PremiumUpgradeDialogComponent>;
  let mockDialogRef: jest.Mocked<DialogRef>;
  let mockSubscriptionPricingService: jest.Mocked<SubscriptionPricingServiceAbstraction>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockEnvironmentService: jest.Mocked<EnvironmentService>;
  let mockPlatformUtilsService: jest.Mocked<PlatformUtilsService>;

  const mockPremiumTier: PersonalSubscriptionPricingTier = {
    id: PersonalSubscriptionPricingTierIds.Premium,
    name: "Premium",
    description: "Advanced features for power users",
    availableCadences: [SubscriptionCadenceIds.Annually],
    passwordManager: {
      type: "standalone",
      annualPrice: 10,
      annualPricePerAdditionalStorageGB: 4,
      features: [
        { key: "feature1", value: "Feature 1" },
        { key: "feature2", value: "Feature 2" },
        { key: "feature3", value: "Feature 3" },
      ],
    },
  };

  const mockFamiliesTier: PersonalSubscriptionPricingTier = {
    id: PersonalSubscriptionPricingTierIds.Families,
    name: "Families",
    description: "Family plan",
    availableCadences: [SubscriptionCadenceIds.Annually],
    passwordManager: {
      type: "packaged",
      users: 6,
      annualPrice: 40,
      annualPricePerAdditionalStorageGB: 4,
      features: [{ key: "featureA", value: "Feature A" }],
    },
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: jest.fn(),
    } as any;

    mockSubscriptionPricingService = {
      getPersonalSubscriptionPricingTiers$: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockEnvironmentService = {
      environment$: of({
        getWebVaultUrl: () => "https://vault.bitwarden.com",
        getRegion: () => Region.US,
      }),
    } as any;

    mockPlatformUtilsService = {
      launchUri: jest.fn(),
    } as any;

    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of([mockPremiumTier, mockFamiliesTier]),
    );

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, PremiumUpgradeDialogComponent, CdkTrapFocus],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: mockSubscriptionPricingService,
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should emit cardDetails$ observable with Premium tier data", async () => {
    const cardDetails = await firstValueFrom(component["cardDetails$"]);

    expect(mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$).toHaveBeenCalled();
    expect(cardDetails).toBeDefined();
    expect(cardDetails?.title).toBe("Premium");
  });

  it("should filter to Premium tier only", async () => {
    const cardDetails = await firstValueFrom(component["cardDetails$"]);

    expect(cardDetails?.title).toBe("Premium");
    expect(cardDetails?.title).not.toBe("Families");
  });

  it("should map Premium tier to card details correctly", async () => {
    const cardDetails = await firstValueFrom(component["cardDetails$"]);

    expect(cardDetails?.title).toBe("Premium");
    expect(cardDetails?.tagline).toBe("Advanced features for power users");
    expect(cardDetails?.price.amount).toBe(10 / 12);
    expect(cardDetails?.price.cadence).toBe("monthly");
    expect(cardDetails?.button.text).toBe("upgradeNow");
    expect(cardDetails?.button.type).toBe("primary");
    expect(cardDetails?.features).toEqual(["Feature 1", "Feature 2", "Feature 3"]);
  });

  it("should use i18nService for button text", async () => {
    const cardDetails = await firstValueFrom(component["cardDetails$"]);

    expect(mockI18nService.t).toHaveBeenCalledWith("upgradeNow");
    expect(cardDetails?.button.text).toBe("upgradeNow");
  });

  it("should emit loading$ observable that starts with true and changes to false", async () => {
    // Create a new component to observe the loading state from start
    const newFixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
    const newComponent = newFixture.componentInstance;

    const loadingValues: boolean[] = [];
    const sub = newComponent["loading$"].subscribe((loading) => loadingValues.push(loading));

    // Wait for the observable to emit
    await firstValueFrom(newComponent["cardDetails$"]);
    sub.unsubscribe();

    expect(loadingValues.length).toBeGreaterThanOrEqual(2);
    expect(loadingValues[0]).toBe(true);
    expect(loadingValues[loadingValues.length - 1]).toBe(false);
  });

  describe("upgrade()", () => {
    it("should launch URI with query parameter for cloud-hosted environments", async () => {
      mockEnvironmentService.environment$ = of({
        getWebVaultUrl: () => "https://vault.bitwarden.com",
        getRegion: () => Region.US,
      } as any);

      await component["upgrade"]();

      expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault.bitwarden.com/#/settings/subscription/premium?callToAction=upgradeToPremium",
      );
      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it("should launch URI without query parameter for self-hosted environments", async () => {
      mockEnvironmentService.environment$ = of({
        getWebVaultUrl: () => "https://self-hosted.example.com",
        getRegion: () => Region.SelfHosted,
      } as any);

      await component["upgrade"]();

      expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://self-hosted.example.com/#/settings/subscription/premium",
      );
      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it("should launch URI with query parameter for EU cloud region", async () => {
      mockEnvironmentService.environment$ = of({
        getWebVaultUrl: () => "https://vault.bitwarden.eu",
        getRegion: () => Region.EU,
      } as any);

      await component["upgrade"]();

      expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault.bitwarden.eu/#/settings/subscription/premium?callToAction=upgradeToPremium",
      );
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  it("should close dialog when close button clicked", () => {
    component["close"]();

    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  describe("error handling", () => {
    it("should show error toast and return null when getPersonalSubscriptionPricingTiers$ throws an error", async () => {
      const error = new Error("Service error");
      mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
        throwError(() => error),
      );

      const errorFixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
      const errorComponent = errorFixture.componentInstance;
      errorFixture.detectChanges();

      const cardDetails = await firstValueFrom(errorComponent["cardDetails$"]);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error",
        message: "unexpectedError",
      });
      expect(cardDetails).toBeNull();
    });

    it("should handle error and still allow loading$ to complete", async () => {
      const error = new Error("Service error");
      mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
        throwError(() => error),
      );

      const errorFixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
      const errorComponent = errorFixture.componentInstance;

      const loadingValues: boolean[] = [];
      const sub = errorComponent["loading$"].subscribe((loading) => loadingValues.push(loading));

      await firstValueFrom(errorComponent["cardDetails$"]);
      sub.unsubscribe();

      expect(loadingValues.length).toBeGreaterThanOrEqual(2);
      expect(loadingValues[0]).toBe(true);
      expect(loadingValues[loadingValues.length - 1]).toBe(false);
    });
  });

  describe("dialog close during loading", () => {
    it("should allow closing dialog while in loading state", () => {
      const newFixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
      const newComponent = newFixture.componentInstance;

      let currentLoadingState: boolean | undefined;
      const sub = newComponent["loading$"].subscribe((loading) => {
        currentLoadingState = loading;
      });

      newComponent["close"]();
      sub.unsubscribe();

      expect(mockDialogRef.close).toHaveBeenCalled();
      expect(currentLoadingState).toBeDefined();
    });
  });
});
