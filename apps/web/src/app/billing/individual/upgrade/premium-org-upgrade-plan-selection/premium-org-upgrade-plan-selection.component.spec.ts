import { CdkTrapFocus } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierIds,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { BillingServicesModule } from "../../../services";

import { PremiumOrgUpgradePlanSelectionComponent } from "./premium-org-upgrade-plan-selection.component";

describe("PremiumOrgUpgradePlanSelectionComponent", () => {
  let sut: PremiumOrgUpgradePlanSelectionComponent;
  let fixture: ComponentFixture<PremiumOrgUpgradePlanSelectionComponent>;
  const mockI18nService = mock<I18nService>();
  const mockSubscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();
  const mockToastService = mock<ToastService>();

  // Mock pricing tiers data
  const mockPersonalPricingTiers: PersonalSubscriptionPricingTier[] = [
    {
      id: PersonalSubscriptionPricingTierIds.Families,
      name: "planNameFamilies",
      description: "Family plan for up to 6 users",
      passwordManager: {
        type: "packaged",
        annualPrice: 40,
        features: [
          { key: "feature1", value: "Feature A" },
          { key: "feature2", value: "Feature B" },
          { key: "feature3", value: "Feature C" },
        ],
        users: 6,
      },
    } as PersonalSubscriptionPricingTier,
  ];

  const mockBusinessPricingTiers: BusinessSubscriptionPricingTier[] = [
    {
      id: BusinessSubscriptionPricingTierIds.Teams,
      name: "planNameTeams",
      description: "Teams plan for growing businesses",
      passwordManager: {
        type: "scalable",
        annualPricePerUser: 48,
        features: [
          { key: "teamFeature1", value: "Teams Feature 1" },
          { key: "teamFeature2", value: "Teams Feature 2" },
          { key: "teamFeature3", value: "Teams Feature 3" },
        ],
      },
    } as BusinessSubscriptionPricingTier,
    {
      id: BusinessSubscriptionPricingTierIds.Enterprise,
      name: "planNameEnterprise",
      description: "Enterprise plan for large organizations",
      passwordManager: {
        type: "scalable",
        annualPricePerUser: 72,
        features: [
          { key: "entFeature1", value: "Enterprise Feature 1" },
          { key: "entFeature2", value: "Enterprise Feature 2" },
          { key: "entFeature3", value: "Enterprise Feature 3" },
        ],
      },
    } as BusinessSubscriptionPricingTier,
  ];

  beforeEach(async () => {
    jest.resetAllMocks();

    mockI18nService.t.mockImplementation((key) => key);
    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of(mockPersonalPricingTiers),
    );
    mockSubscriptionPricingService.getBusinessSubscriptionPricingTiers$.mockReturnValue(
      of(mockBusinessPricingTiers),
    );

    await TestBed.configureTestingModule({
      imports: [PremiumOrgUpgradePlanSelectionComponent, PricingCardComponent, CdkTrapFocus],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: mockSubscriptionPricingService,
        },
        { provide: ToastService, useValue: mockToastService },
      ],
    })
      .overrideComponent(PremiumOrgUpgradePlanSelectionComponent, {
        remove: { imports: [BillingServicesModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PremiumOrgUpgradePlanSelectionComponent);
    sut = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(sut).toBeTruthy();
  });

  it("should set loading to false after pricing tiers are loaded", () => {
    expect(sut["loading"]()).toBe(false);
  });

  it("should set up pricing tier details for all three plans", () => {
    expect(sut["familiesCardDetails"]).toBeDefined();
    expect(sut["teamsCardDetails"]).toBeDefined();
    expect(sut["enterpriseCardDetails"]).toBeDefined();
  });

  describe("card details creation", () => {
    it("should create families card details correctly", () => {
      expect(sut["familiesCardDetails"].title).toBe("planNameFamilies");
      expect(sut["familiesCardDetails"].tagline).toBe("Family plan for up to 6 users");
      expect(sut["familiesCardDetails"].price.amount).toBe(40 / 12);
      expect(sut["familiesCardDetails"].price.cadence).toBe("month");
      expect(sut["familiesCardDetails"].button.type).toBe("primary");
      expect(sut["familiesCardDetails"].button.text).toBe("upgradeToFamilies");
      expect(sut["familiesCardDetails"].features).toEqual(["Feature A", "Feature B", "Feature C"]);
    });

    it("should create teams card details correctly", () => {
      expect(sut["teamsCardDetails"].title).toBe("planNameTeams");
      expect(sut["teamsCardDetails"].tagline).toBe("Teams plan for growing businesses");
      expect(sut["teamsCardDetails"].price.amount).toBe(48 / 12);
      expect(sut["teamsCardDetails"].price.cadence).toBe("month");
      expect(sut["teamsCardDetails"].button.type).toBe("secondary");
      expect(sut["teamsCardDetails"].button.text).toBe("upgradeToTeams");
      expect(sut["teamsCardDetails"].features).toEqual([
        "Teams Feature 1",
        "Teams Feature 2",
        "Teams Feature 3",
      ]);
    });

    it("should create enterprise card details correctly", () => {
      expect(sut["enterpriseCardDetails"].title).toBe("planNameEnterprise");
      expect(sut["enterpriseCardDetails"].tagline).toBe("Enterprise plan for large organizations");
      expect(sut["enterpriseCardDetails"].price.amount).toBe(72 / 12);
      expect(sut["enterpriseCardDetails"].price.cadence).toBe("month");
      expect(sut["enterpriseCardDetails"].button.type).toBe("secondary");
      expect(sut["enterpriseCardDetails"].button.text).toBe("upgradeToEnterprise");
      expect(sut["enterpriseCardDetails"].features).toEqual([
        "Enterprise Feature 1",
        "Enterprise Feature 2",
        "Enterprise Feature 3",
      ]);
    });
  });

  describe("plan selection", () => {
    it("should emit planSelected with families pricing tier when families plan is selected", () => {
      const emitSpy = jest.spyOn(sut.planSelected, "emit");
      // The first PricingCardComponent corresponds to the families plan
      const familiesCard = fixture.debugElement.queryAll(By.directive(PricingCardComponent))[0];
      familiesCard.triggerEventHandler("buttonClick", {});
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith(PersonalSubscriptionPricingTierIds.Families);
    });

    it("should emit planSelected with teams pricing tier when teams plan is selected", () => {
      const emitSpy = jest.spyOn(sut.planSelected, "emit");
      // The second PricingCardComponent corresponds to the teams plan
      const teamsCard = fixture.debugElement.queryAll(By.directive(PricingCardComponent))[1];
      teamsCard.triggerEventHandler("buttonClick", {});
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith(BusinessSubscriptionPricingTierIds.Teams);
    });

    it("should emit planSelected with enterprise pricing tier when enterprise plan is selected", () => {
      const emitSpy = jest.spyOn(sut.planSelected, "emit");
      // The third PricingCardComponent corresponds to the enterprise plan
      const enterpriseCard = fixture.debugElement.queryAll(By.directive(PricingCardComponent))[2];
      enterpriseCard.triggerEventHandler("buttonClick", {});
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith(BusinessSubscriptionPricingTierIds.Enterprise);
    });
  });

  describe("error handling", () => {
    it("should show toast and set loading to false on error", () => {
      mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
        throwError(() => new Error("API Error")),
      );
      mockSubscriptionPricingService.getBusinessSubscriptionPricingTiers$.mockReturnValue(
        of(mockBusinessPricingTiers),
      );

      fixture = TestBed.createComponent(PremiumOrgUpgradePlanSelectionComponent);
      sut = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: "unexpectedError",
      });
      expect(sut["loading"]()).toBe(false);
      expect(sut["familiesCardDetails"]).toBeUndefined();
      expect(sut["teamsCardDetails"]).toBeUndefined();
      expect(sut["enterpriseCardDetails"]).toBeUndefined();
    });
  });
});
