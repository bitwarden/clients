import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { BillingServicesModule } from "../../../services";
import { SubscriptionPricingService } from "../../../services/subscription-pricing.service";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
} from "../../../types/subscription-pricing-tier";

import {
  UpgradeAccountDialogComponent,
  UpgradeAccountDialogResult,
  UpgradeAccountDialogStatus,
} from "./upgrade-account-dialog.component";

describe("UpgradeAccountDialogComponent", () => {
  let sut: UpgradeAccountDialogComponent;
  let fixture: ComponentFixture<UpgradeAccountDialogComponent>;
  const mockDialogRef = mock<DialogRef<UpgradeAccountDialogResult>>();
  const mockI18nService = mock<I18nService>();
  const mockSubscriptionPricingService = mock<SubscriptionPricingService>();
  const mockDialogService = mock<DialogService>();

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
      imports: [NoopAnimationsModule, UpgradeAccountDialogComponent, PricingCardComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
        { provide: SubscriptionPricingService, useValue: mockSubscriptionPricingService },
        { provide: DIALOG_DATA, useValue: {} },
      ],
    })
      .overrideComponent(UpgradeAccountDialogComponent, {
        // Remove BillingServicesModule to avoid conflicts with mocking SubscriptionPricingService dependencies
        remove: { imports: [BillingServicesModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UpgradeAccountDialogComponent);
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
    expect(sut["familiesCardDetails"].button.text).toBe("upgradeToFamilies");
    expect(sut["familiesCardDetails"].features).toEqual(["Feature A", "Feature B", "Feature C"]);
  });

  it("should call dialogRef.close with proceeded-to-payment status and premium pricing tier when premium plan is selected", () => {
    sut["onProceedClick"](PersonalSubscriptionPricingTierIds.Premium);

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      status: UpgradeAccountDialogStatus.ProceededToPayment,
      plan: PersonalSubscriptionPricingTierIds.Premium,
    });
  });

  it("should call dialogRef.close with proceeded-to-payment status and families pricing tier when families plan is selected", () => {
    sut["onProceedClick"](PersonalSubscriptionPricingTierIds.Families);

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      status: UpgradeAccountDialogStatus.ProceededToPayment,
      plan: PersonalSubscriptionPricingTierIds.Families,
    });
  });

  it("should call dialogRef.close with closed status when dialog is closed", () => {
    sut["onCloseClick"]();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      status: UpgradeAccountDialogStatus.Closed,
      plan: null,
    });
  });

  it("should return a DialogRef when open static method is called", () => {
    mockDialogService.open.mockReturnValue(mockDialogRef);

    const dialogConfig = { data: {} };
    const result = UpgradeAccountDialogComponent.open(mockDialogService, dialogConfig);

    expect(mockDialogService.open).toHaveBeenCalledWith(
      UpgradeAccountDialogComponent,
      dialogConfig,
    );
    expect(result).toBe(mockDialogRef);
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

  describe("dialogTitle", () => {
    it("should use default title when no override is provided", () => {
      expect(sut.dialogTitle).toBe("individualUpgradeWelcomeMessage");
    });

    it("should use override title when provided in dialog config", async () => {
      TestBed.resetTestingModule();

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UpgradeAccountDialogComponent, PricingCardComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: I18nService, useValue: mockI18nService },
          { provide: SubscriptionPricingService, useValue: mockSubscriptionPricingService },
          { provide: DIALOG_DATA, useValue: { dialogTitleMessageOverride: "customTitleKey" } },
        ],
      })
        .overrideComponent(UpgradeAccountDialogComponent, {
          remove: { imports: [BillingServicesModule] },
        })
        .compileComponents();

      const customFixture = TestBed.createComponent(UpgradeAccountDialogComponent);
      const customComponent = customFixture.componentInstance;
      customFixture.detectChanges();

      expect(customComponent.dialogTitle).toBe("customTitleKey");
    });
  });
});
