import { CdkTrapFocus } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { firstValueFrom, of, throwError } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PremiumCheckoutPendingService } from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { PremiumCheckoutSessionResponse } from "@bitwarden/common/billing/models/response/premium-checkout-session.response";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

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
  let mockLogService: jest.Mocked<LogService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockBillingApiService: jest.Mocked<BillingApiServiceAbstraction>;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockPremiumCheckoutPendingService: jest.Mocked<PremiumCheckoutPendingService>;

  const mockPremiumTier: PersonalSubscriptionPricingTier = {
    id: PersonalSubscriptionPricingTierIds.Premium,
    name: "Premium",
    description: "Advanced features for power users",
    availableCadences: [SubscriptionCadenceIds.Annually],
    passwordManager: {
      type: "standalone",
      annualPrice: 10,
      annualPricePerAdditionalStorageGB: 4,
      providedStorageGB: 1,
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
      providedStorageGB: 1,
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
        isCloud: () => true,
      }),
    } as any;

    mockPlatformUtilsService = {
      launchUri: jest.fn(),
      getClientType: jest.fn().mockReturnValue(ClientType.Browser),
    } as any;

    mockConfigService = {
      getFeatureFlag: jest.fn().mockResolvedValue(false),
    } as any;

    mockBillingApiService = {
      createPremiumCheckoutSession: jest.fn(),
    } as any;

    mockAccountService = {
      activeAccount$: of({ id: "user-1" as UserId }),
    } as any;

    mockPremiumCheckoutPendingService = {
      markCheckoutLaunched: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of([mockPremiumTier, mockFamiliesTier]),
    );

    mockLogService = {
      error: jest.fn(),
    } as any;

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
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: BillingApiServiceAbstraction, useValue: mockBillingApiService },
        { provide: AccountService, useValue: mockAccountService },
        {
          provide: PremiumCheckoutPendingService,
          useValue: mockPremiumCheckoutPendingService,
        },
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

  describe("upgrade()", () => {
    describe("flag-disabled / self-host flow", () => {
      it("should launch URI with query parameter when checkout flag is disabled", async () => {
        mockConfigService.getFeatureFlag.mockResolvedValue(false);

        await component["upgrade"]();

        expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM34515_BrowserDesktopCheckout,
        );
        expect(mockBillingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://vault.bitwarden.com/#/settings/subscription/premium?callToAction=upgradeToPremium",
        );
        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("does NOT mark checkout pending on the web-vault fallback", async () => {
        mockConfigService.getFeatureFlag.mockResolvedValue(false);

        await component["upgrade"]();

        expect(mockPremiumCheckoutPendingService.markCheckoutLaunched).not.toHaveBeenCalled();
      });

      it("should launch web vault URL on self-host even when flag is enabled", async () => {
        // Checkout flag on, QA bypass flag off: self-host must still fall back.
        mockConfigService.getFeatureFlag.mockImplementation((flag: FeatureFlag) =>
          Promise.resolve(flag === FeatureFlag.PM34515_BrowserDesktopCheckout),
        );
        mockEnvironmentService.environment$ = of({
          getWebVaultUrl: () => "https://self-hosted.example.com",
          getRegion: () => Region.SelfHosted,
          isCloud: () => false,
        }) as any;

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://self-hosted.example.com/#/settings/subscription/premium?callToAction=upgradeToPremium",
        );
        expect(mockDialogRef.close).toHaveBeenCalled();
      });
    });

    describe("Stripe checkout flow (cloud + flag enabled)", () => {
      beforeEach(() => {
        mockConfigService.getFeatureFlag.mockResolvedValue(true);
        mockBillingApiService.createPremiumCheckoutSession.mockResolvedValue({
          checkoutSessionUrl: "https://checkout.stripe.com/c/pay/cs_123",
        } as any);
      });

      it("should call checkout API with browser platform on browser client", async () => {
        mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Browser);

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).toHaveBeenCalledWith({
          platform: "browser",
        });
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://checkout.stripe.com/c/pay/cs_123",
        );
        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("marks checkout pending after launching external checkout", async () => {
        mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Browser);

        await component["upgrade"]();

        expect(mockPremiumCheckoutPendingService.markCheckoutLaunched).toHaveBeenCalledWith(
          "user-1" as UserId,
        );
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://checkout.stripe.com/c/pay/cs_123",
        );
      });

      it("still launches checkout and shows no error toast when marking pending fails", async () => {
        mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
        const error = new Error("state write failed");
        mockPremiumCheckoutPendingService.markCheckoutLaunched.mockRejectedValue(error);

        await component["upgrade"]();

        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://checkout.stripe.com/c/pay/cs_123",
        );
        expect(mockToastService.showToast).not.toHaveBeenCalled();
        expect(mockLogService.error).toHaveBeenCalledWith(
          "Failed to mark premium checkout as pending; sync recovery on refocus may not fire",
          error,
        );
      });

      it("should call checkout API with desktop platform on desktop client", async () => {
        mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).toHaveBeenCalledWith({
          platform: "desktop",
        });
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://checkout.stripe.com/c/pay/cs_123",
        );
        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("should fall back to web vault when client type is unsupported (e.g. Web)", async () => {
        mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Web);

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://vault.bitwarden.com/#/settings/subscription/premium?callToAction=upgradeToPremium",
        );
        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("should show error toast and close dialog when checkout API fails", async () => {
        const error = new Error("Network error");
        mockBillingApiService.createPremiumCheckoutSession.mockRejectedValue(error);

        await component["upgrade"]();

        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "error",
          message: "unexpectedError",
        });
        expect(mockLogService.error).toHaveBeenCalledWith("Failed to start premium upgrade", error);
        expect(mockPlatformUtilsService.launchUri).not.toHaveBeenCalled();
        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("should show error toast and close dialog when feature flag lookup rejects", async () => {
        const error = new Error("Config service unavailable");
        mockConfigService.getFeatureFlag.mockRejectedValue(error);

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "error",
          message: "unexpectedError",
        });
        expect(mockLogService.error).toHaveBeenCalledWith("Failed to start premium upgrade", error);
        expect(mockDialogRef.close).toHaveBeenCalled();
      });

      it("should disable the upgrade button while the checkout API call is in flight", async () => {
        let resolveCheckout: (value: PremiumCheckoutSessionResponse) => void = () => undefined;
        mockBillingApiService.createPremiumCheckoutSession.mockReturnValue(
          new Promise((resolve) => {
            resolveCheckout = resolve;
          }),
        );

        const upgradePromise = component["upgrade"]();
        await Promise.resolve();

        expect(component["upgrading"]()).toBe(true);

        resolveCheckout({ checkoutSessionUrl: "https://checkout.stripe.com/c/pay/cs_123" } as any);
        await upgradePromise;

        expect(component["upgrading"]()).toBe(false);
      });

      it("should ignore re-entrant clicks while a checkout call is in flight", async () => {
        let resolveCheckout: (value: PremiumCheckoutSessionResponse) => void = () => undefined;
        mockBillingApiService.createPremiumCheckoutSession.mockReturnValue(
          new Promise((resolve) => {
            resolveCheckout = resolve;
          }),
        );

        const firstCall = component["upgrade"]();
        const secondCall = component["upgrade"]();

        resolveCheckout({ checkoutSessionUrl: "https://checkout.stripe.com/c/pay/cs_123" } as any);
        await Promise.all([firstCall, secondCall]);

        expect(mockBillingApiService.createPremiumCheckoutSession).toHaveBeenCalledTimes(1);
      });
    });

    describe("self-host QA bypass flag", () => {
      // Resolves the two flags upgrade() reads, independently.
      const mockFlags = (checkout: boolean, bypass: boolean) => {
        mockConfigService.getFeatureFlag.mockImplementation((flag: FeatureFlag) =>
          Promise.resolve(
            flag === FeatureFlag.PM34515_BrowserDesktopCheckout
              ? checkout
              : flag === FeatureFlag.DebugDisableSelfHostPremiumCheck
                ? bypass
                : false,
          ),
        );
      };

      beforeEach(() => {
        // Self-hosted region: isCloud() is false.
        mockEnvironmentService.environment$ = of({
          getWebVaultUrl: () => "https://self-hosted.example.com",
          getRegion: () => Region.SelfHosted,
          isCloud: () => false,
        }) as any;
        mockBillingApiService.createPremiumCheckoutSession.mockResolvedValue({
          checkoutSessionUrl: "https://checkout.stripe.com/c/pay/cs_123",
        } as any);
      });

      it("takes the Stripe checkout branch on self-host when checkout + bypass flags are both on", async () => {
        mockFlags(true, true);
        mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Browser);

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).toHaveBeenCalledWith({
          platform: "browser",
        });
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://checkout.stripe.com/c/pay/cs_123",
        );
      });

      it("falls back to web vault on self-host when bypass flag is on but checkout flag is off", async () => {
        mockFlags(false, true);

        await component["upgrade"]();

        expect(mockBillingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://self-hosted.example.com/#/settings/subscription/premium?callToAction=upgradeToPremium",
        );
      });
    });
  });

  it("should close dialog when close button clicked", () => {
    component["close"]();

    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  describe("error handling", () => {
    it("should show error toast and return EMPTY and close dialog when getPersonalSubscriptionPricingTiers$ throws an error", (done) => {
      const error = new Error("Service error");
      mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
        throwError(() => error),
      );

      const errorFixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
      const errorComponent = errorFixture.componentInstance;
      errorFixture.detectChanges();

      const cardDetails$ = errorComponent["cardDetails$"];

      cardDetails$.subscribe({
        next: () => {
          done.fail("Observable should not emit any values");
        },
        complete: () => {
          expect(mockToastService.showToast).toHaveBeenCalledWith({
            variant: "error",
            title: "error",
            message: "unexpectedError",
          });
          expect(mockDialogRef.close).toHaveBeenCalled();
          done();
        },
        error: (err: unknown) => done.fail(`Observable should not error: ${err}`),
      });
    });
  });

  describe("self-hosted environment", () => {
    it("should handle null price data for self-hosted environment", async () => {
      const selfHostedPremiumTier: PersonalSubscriptionPricingTier = {
        id: PersonalSubscriptionPricingTierIds.Premium,
        name: "Premium",
        description: "Advanced features for power users",
        availableCadences: [SubscriptionCadenceIds.Annually],
        passwordManager: {
          type: "standalone",
          annualPrice: undefined as any, // self-host will have these prices empty
          annualPricePerAdditionalStorageGB: undefined as any,
          providedStorageGB: undefined as any,
          features: [
            { key: "feature1", value: "Feature 1" },
            { key: "feature2", value: "Feature 2" },
          ],
        },
      };

      mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
        of([selfHostedPremiumTier]),
      );

      const selfHostedFixture = TestBed.createComponent(PremiumUpgradeDialogComponent);
      const selfHostedComponent = selfHostedFixture.componentInstance;
      selfHostedFixture.detectChanges();

      const cardDetails = await firstValueFrom(selfHostedComponent["cardDetails$"]);

      expect(cardDetails?.title).toBe("Premium");
      expect(cardDetails?.price).toBeUndefined();
      expect(cardDetails?.features).toEqual(["Feature 1", "Feature 2"]);
    });
  });
});
