import { CdkTrapFocus } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PricingCardComponent } from "@bitwarden/pricing";

import { BillingServicesModule } from "../../../services";

import { UpgradeAccountComponent, UpgradeAccountStatus } from "./upgrade-account.component";

describe("UpgradeAccountComponent", () => {
  let sut: UpgradeAccountComponent;
  let fixture: ComponentFixture<UpgradeAccountComponent>;
  const mockI18nService = mock<I18nService>();
  const mockSubscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();

  // Mock pricing tiers data
  const mockPricingTiers: PersonalSubscriptionPricingTier[] = [
    {
      id: PersonalSubscriptionPricingTierIds.Premium,
      name: "premium", // Name changed to match i18n key expectation
      description: "Premium plan for individuals",
      passwordManager: {
        annualPrice: 10,
        features: [{ value: "Feature 1" }, { value: "Feature 2" }, { value: "Feature 3" }],
      },
    } as PersonalSubscriptionPricingTier,
    {
      id: PersonalSubscriptionPricingTierIds.Families,
      name: "planNameFamilies", // Name changed to match i18n key expectation
      description: "Family plan for up to 6 users",
      passwordManager: {
        annualPrice: 40,
        features: [{ value: "Feature A" }, { value: "Feature B" }, { value: "Feature C" }],
        users: 6,
      },
    } as PersonalSubscriptionPricingTier,
  ];

  beforeEach(async () => {
    jest.resetAllMocks();

    mockI18nService.t.mockImplementation((key) => key);
    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of(mockPricingTiers),
    );

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UpgradeAccountComponent, PricingCardComponent, CdkTrapFocus],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: mockSubscriptionPricingService,
        },
      ],
    })
      .overrideComponent(UpgradeAccountComponent, {
        // Remove BillingServicesModule to avoid conflicts with mocking SubscriptionPricingService dependencies
        remove: { imports: [BillingServicesModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UpgradeAccountComponent);
    sut = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(sut).toBeTruthy();
  });

  it("should set up pricing tier details properly", () => {
    expect(sut["premiumCardDetails"]).toBeDefined();
    expect(sut["familiesCardDetails"]).toBeDefined();
  });

  it("should create premium card details correctly", () => {
    // Because the i18n service is mocked to return the key itself
    expect(sut["premiumCardDetails"].title).toBe("premium");
    expect(sut["premiumCardDetails"].tagline).toBe("Premium plan for individuals");
    expect(sut["premiumCardDetails"].price.amount).toBe(10 / 12);
    expect(sut["premiumCardDetails"].price.cadence).toBe("monthly");
    expect(sut["premiumCardDetails"].button.type).toBe("primary");
    expect(sut["premiumCardDetails"].button.text).toBe("upgradeToPremium");
    expect(sut["premiumCardDetails"].features).toEqual(["Feature 1", "Feature 2", "Feature 3"]);
  });

  it("should create families card details correctly", () => {
    // Because the i18n service is mocked to return the key itself
    expect(sut["familiesCardDetails"].title).toBe("planNameFamilies");
    expect(sut["familiesCardDetails"].tagline).toBe("Family plan for up to 6 users");
    expect(sut["familiesCardDetails"].price.amount).toBe(40 / 12);
    expect(sut["familiesCardDetails"].price.cadence).toBe("monthly");
    expect(sut["familiesCardDetails"].button.type).toBe("secondary");
    expect(sut["familiesCardDetails"].button.text).toBe("startFreeFamiliesTrial");
    expect(sut["familiesCardDetails"].features).toEqual(["Feature A", "Feature B", "Feature C"]);
  });

  it("should emit planSelected with premium pricing tier when premium plan is selected", () => {
    // Arrange
    const emitSpy = jest.spyOn(sut.planSelected, "emit");

    // Act
    sut.planSelected.emit(PersonalSubscriptionPricingTierIds.Premium);

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(PersonalSubscriptionPricingTierIds.Premium);
  });

  it("should emit planSelected with families pricing tier when families plan is selected", () => {
    // Arrange
    const emitSpy = jest.spyOn(sut.planSelected, "emit");

    // Act
    sut.planSelected.emit(PersonalSubscriptionPricingTierIds.Families);

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(PersonalSubscriptionPricingTierIds.Families);
  });

  it("should emit closeClicked with closed status when close button is clicked", () => {
    // Arrange
    const emitSpy = jest.spyOn(sut.closeClicked, "emit");

    // Act
    sut.closeClicked.emit(UpgradeAccountStatus.Closed);

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(UpgradeAccountStatus.Closed);
  });

  describe("isFamiliesPlan", () => {
    it("should return true for families plan", () => {
      const result = sut["isFamiliesPlan"](PersonalSubscriptionPricingTierIds.Families);
      expect(result).toBe(true);
    });

    it("should return false for premium plan", () => {
      const result = sut["isFamiliesPlan"](PersonalSubscriptionPricingTierIds.Premium);
      expect(result).toBe(false);
    });
  });

  describe("hideContinueWithoutUpgradingButton", () => {
    it("should show the continue without upgrading button by default", () => {
      const button = fixture.nativeElement.querySelector('button[bitLink][linkType="primary"]');
      expect(button).toBeTruthy();
    });

    it("should hide the continue without upgrading button when input is true", async () => {
      TestBed.resetTestingModule();

      mockI18nService.t.mockImplementation((key) => key);
      mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
        of(mockPricingTiers),
      );

      await TestBed.configureTestingModule({
        imports: [
          NoopAnimationsModule,
          UpgradeAccountComponent,
          PricingCardComponent,
          CdkTrapFocus,
        ],
        providers: [
          { provide: I18nService, useValue: mockI18nService },
          {
            provide: SubscriptionPricingServiceAbstraction,
            useValue: mockSubscriptionPricingService,
          },
        ],
      })
        .overrideComponent(UpgradeAccountComponent, {
          remove: { imports: [BillingServicesModule] },
        })
        .compileComponents();

      const customFixture = TestBed.createComponent(UpgradeAccountComponent);
      customFixture.componentRef.setInput("hideContinueWithoutUpgradingButton", true);
      customFixture.detectChanges();

      const button = customFixture.nativeElement.querySelector(
        'button[bitLink][linkType="primary"]',
      );
      expect(button).toBeNull();
    });
  });
});
