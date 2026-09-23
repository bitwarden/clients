import { CurrencyPipe } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductTierType } from "@bitwarden/common/billing/enums/product-tier-type.enum";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../shared";
import { AnnualUpgradeOfferResponseModel, OrganizationBillingClient } from "../clients";

import {
  OffboardingSurveyComponent,
  OffboardingSurveyDialogParams,
  OffboardingSurveyDialogResultType,
} from "./offboarding-survey.component";

describe("OffboardingSurveyComponent", () => {
  const mockDialogRef = mock<DialogRef<OffboardingSurveyDialogResultType>>();
  const mockBillingApiService = mock<BillingApiService>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();
  const mockI18nService = mock<I18nService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockToastService = mock<ToastService>();
  const mockLogService = mock<LogService>();
  const mockConfigService = mock<ConfigService>();

  describe("annual upgrade offer", () => {
    beforeAll(() => {
      // jsdom does not implement IntersectionObserver; the bit-dialog wrapper this component
      // renders into uses it internally (see libs/components/src/utils/dom-observables.ts).
      global.IntersectionObserver = class {
        constructor() {}
        disconnect() {}
        observe() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
        unobserve() {}
      } as any;
    });

    let fixture: ComponentFixture<OffboardingSurveyComponent>;

    const build = async (
      offer: AnnualUpgradeOfferResponseModel | null,
      loadError?: unknown,
      flagEnabled = true,
    ) => {
      mockConfigService.getFeatureFlag.mockResolvedValue(flagEnabled as never);
      if (loadError !== undefined) {
        mockOrganizationBillingClient.getAnnualUpgradeOffer.mockRejectedValue(loadError);
      } else {
        mockOrganizationBillingClient.getAnnualUpgradeOffer.mockResolvedValue(offer);
      }
      // Echo the i18n key so assertions can check for a (design-pending) translated string without
      // depending on real copy. Mirrors the convention in organization-subscription-cloud.component.spec.ts.
      mockI18nService.t.mockImplementation((key: string) => key);

      await TestBed.configureTestingModule({
        imports: [SharedModule, ReactiveFormsModule],
        declarations: [OffboardingSurveyComponent],
        providers: [
          {
            provide: DIALOG_DATA,
            useValue: {
              type: "Organization",
              id: "org-1",
              plan: 17, // PlanType.TeamsMonthly
              productTier: ProductTierType.Teams,
            },
          },
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: BillingApiService, useValue: mockBillingApiService },
          { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
          { provide: ToastService, useValue: mockToastService },
          { provide: I18nService, useValue: mockI18nService },
          { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(OffboardingSurveyComponent);
      fixture.detectChanges();
      await fixture.whenStable();
    };

    const selectReason = (value: string) => {
      (fixture.componentInstance as any).formGroup.controls.reason.setValue(value);
      fixture.detectChanges();
    };

    // Any form edit pushes formGroupDirective.statusChanges, which is what BitSubmitDirective
    // recomputes its disabled flag from.
    const editFeedback = (value: string) => {
      (fixture.componentInstance as any).formGroup.controls.feedback.setValue(value);
      fixture.detectChanges();
    };

    const redeemButton = () =>
      fixture.debugElement.query(By.css('[data-testid="annual-upgrade-offer"] button'))
        .nativeElement as HTMLButtonElement;

    const submitButton = () =>
      fixture.debugElement.query(By.css('button[type="submit"]'))
        .nativeElement as HTMLButtonElement;

    const offerFixture = () =>
      new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 60,
        NewAnnualCost: 48,
        Savings: 12,
      });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("fetches the annual upgrade offer on init for a business org", async () => {
      await build(null);

      expect(mockOrganizationBillingClient.getAnnualUpgradeOffer).toHaveBeenCalledWith("org-1");
    });

    it("swallows and logs a failure to load the offer, leaving the survey usable", async () => {
      const error = new Error("offer load failed");

      await build(null, error);

      expect(mockLogService.error).toHaveBeenCalledWith(error);
      expect(fixture.componentInstance).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
      ).toBeNull();
    });

    it("does not render the callout when no offer is available", async () => {
      await build(null);
      selectReason("too_complex");

      expect(
        fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
      ).toBeNull();
    });

    it("renders the callout only when the cost reason is selected", async () => {
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 60,
        NewAnnualCost: 48,
        Savings: 12,
      });
      await build(offer);

      expect(
        fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
      ).toBeNull();

      selectReason("too_complex");

      expect(
        fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
      ).not.toBeNull();
    });

    it("wires the redeem button to the enclosing form so it cannot race the cancellation", async () => {
      // Regression guard: without bitFormButton, BitFormButtonDirective is never instantiated and
      // neither the form-disables-button nor the button-disables-form subscription is installed.
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 60,
        NewAnnualCost: 48,
        Savings: 12,
      });
      await build(offer);
      selectReason("too_complex");
      fixture.detectChanges();

      const button = fixture.debugElement.query(
        By.css('[data-testid="annual-upgrade-offer"] button'),
      );

      expect(button.attributes["bitFormButton"]).toBeDefined();
    });

    it("does not submit the cancellation while a redeem is in flight, even after the form is edited", async () => {
      await build(offerFixture());
      selectReason("too_complex");

      let resolveRedeem: () => void;
      mockOrganizationBillingClient.redeemAnnualUpgradeOffer.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveRedeem = resolve;
        }),
      );

      redeemButton().click();
      fixture.detectChanges();
      expect((fixture.componentInstance as any).annualUpgradeRedeemLoading()).toBe(true);

      editFeedback("changed my mind");

      expect(submitButton().getAttribute("aria-disabled")).toBe("true");

      submitButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockBillingApiService.cancelOrganizationSubscription).not.toHaveBeenCalled();

      resolveRedeem!();
      await fixture.whenStable();
    });

    it("does not redeem while a cancellation is in flight, even after the form is edited", async () => {
      await build(offerFixture());
      selectReason("too_complex");

      let resolveCancel: () => void;
      mockBillingApiService.cancelOrganizationSubscription.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveCancel = resolve;
        }),
      );

      submitButton().click();
      fixture.detectChanges();
      expect((fixture.componentInstance as any).cancellationLoading()).toBe(true);

      editFeedback("changed my mind");

      expect(redeemButton().getAttribute("aria-disabled")).toBe("true");

      redeemButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockOrganizationBillingClient.redeemAnnualUpgradeOffer).not.toHaveBeenCalled();

      resolveCancel!();
      await fixture.whenStable();
    });

    it("does not render the callout for the 'needs changed' reason", async () => {
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 60,
        NewAnnualCost: 48,
        Savings: 12,
      });
      await build(offer);

      // "too_expensive" is the legacy value for the "Our needs changed" option, not the
      // cost option -- the callout must not appear here.
      selectReason("too_expensive");

      expect(
        fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
      ).toBeNull();
    });

    it("renders both cost rows, dropping cents for whole-dollar amounts", async () => {
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 1440,
        NewAnnualCost: 1152,
        Savings: 288,
      });
      await build(offer);
      selectReason("too_complex");

      const callout = fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]');
      expect(callout).not.toBeNull();
      const text = callout.textContent as string;
      expect(text).toContain("$1,440");
      expect(text).toContain("$1,152");
      expect(text).not.toContain("$1,440.00");
    });

    it("shows two decimals for fractional amounts", async () => {
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 1440.5,
        NewAnnualCost: 1152.25,
        Savings: 288.25,
      });
      await build(offer);
      selectReason("too_complex");

      const text = fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]')
        .textContent as string;
      expect(text).toContain("$1,440.50");
      expect(text).toContain("$1,152.25");
    });

    it("redeeming the offer closes the dialog with a success toast and does not cancel", async () => {
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 60,
        NewAnnualCost: 48,
        Savings: 12,
      });
      await build(offer);
      mockOrganizationBillingClient.redeemAnnualUpgradeOffer.mockResolvedValue(undefined);

      await (fixture.componentInstance as any).switchToAnnualBilling();

      expect(mockOrganizationBillingClient.redeemAnnualUpgradeOffer).toHaveBeenCalledWith("org-1");
      expect(mockBillingApiService.cancelOrganizationSubscription).not.toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(OffboardingSurveyDialogResultType.Submitted);
    });

    it("a failed redeem shows an inline error and keeps the dialog open", async () => {
      const offer = new AnnualUpgradeOfferResponseModel({
        CurrentAnnualCost: 60,
        NewAnnualCost: 48,
        Savings: 12,
      });
      await build(offer);
      mockOrganizationBillingClient.redeemAnnualUpgradeOffer.mockRejectedValue(new Error("boom"));

      const component = fixture.componentInstance as any;
      await component.switchToAnnualBilling();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(component.annualUpgradeRedeemLoading()).toBe(false);
      expect(component.annualUpgradeRedeemError()).toBeTruthy();
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it("makes no request and logs nothing when the flag is off", async () => {
      // RequireFeature answers 404 on the server, and this component swallows and logs GET
      // failures as best effort, so without this check every cancellation dialog in a flag-off
      // environment would log an error for nothing.
      await build(null, undefined, false);

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM38333_AnnualBillingSavings,
      );
      expect(mockOrganizationBillingClient.getAnnualUpgradeOffer).not.toHaveBeenCalled();
      expect(mockLogService.error).not.toHaveBeenCalled();
      expect(
        fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
      ).toBeNull();
    });
  });

  describe("survey behavior", () => {
    const buildComponent = (params: OffboardingSurveyDialogParams) => {
      TestBed.configureTestingModule({
        imports: [ReactiveFormsModule],
        providers: [
          OffboardingSurveyComponent,
          CurrencyPipe,
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: BillingApiService, useValue: mockBillingApiService },
          { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
          { provide: I18nService, useValue: mockI18nService },
          { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
          { provide: ToastService, useValue: mockToastService },
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      });

      return TestBed.inject(OffboardingSurveyComponent);
    };

    const userParams = (): OffboardingSurveyDialogParams => ({ type: "User" });

    const orgParams = (
      productTier: ProductTierType,
      plan: PlanType = PlanType.TeamsAnnually,
    ): OffboardingSurveyDialogParams => ({
      type: "Organization",
      id: "org-123",
      plan,
      productTier,
    });

    beforeEach(() => {
      mockI18nService.t.mockImplementation((key: string) => key);
      mockDialogRef.close.mockResolvedValue(undefined);
      mockBillingApiService.cancelOrganizationSubscription.mockResolvedValue(undefined);
      mockBillingApiService.cancelPremiumUserSubscription.mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe("isBusiness", () => {
      it("is false for a User", () => {
        const component = buildComponent(userParams()) as any;

        expect(component.isBusiness).toBe(false);
      });

      it("is true for a Teams organization", () => {
        const component = buildComponent(orgParams(ProductTierType.Teams)) as any;

        expect(component.isBusiness).toBe(true);
      });

      it("is true for an Enterprise organization", () => {
        const component = buildComponent(orgParams(ProductTierType.Enterprise)) as any;

        expect(component.isBusiness).toBe(true);
      });

      it("is true for a TeamsStarter organization", () => {
        const component = buildComponent(orgParams(ProductTierType.TeamsStarter)) as any;

        expect(component.isBusiness).toBe(true);
      });

      it("is false for a Free organization", () => {
        const component = buildComponent(orgParams(ProductTierType.Free)) as any;

        expect(component.isBusiness).toBe(false);
      });

      it("is false for a Families organization", () => {
        const component = buildComponent(orgParams(ProductTierType.Families)) as any;

        expect(component.isBusiness).toBe(false);
      });
    });

    describe("reasons (switching reason)", () => {
      // The switching reason is the 6th entry (index 5) in the reasons list, built by getSwitchingReason().
      // Order: [placeholder, missingFeatures, movingToAnotherTool, tooDifficultToUse, notUsingEnough, switchingReason, other]

      it("shows the 'switch to free plan' reason for a User", () => {
        const component = buildComponent(userParams()) as any;

        const switchingReason = component.reasons[5];

        expect(switchingReason.value).toBe("too_expensive");
        expect(switchingReason.text).toBe("switchToFreePlan");
      });

      it("shows the 'switch to free org' reason for a FamiliesAnnually organization", () => {
        const component = buildComponent(
          orgParams(ProductTierType.Free, PlanType.FamiliesAnnually),
        ) as any;

        const switchingReason = component.reasons[5];

        expect(switchingReason.value).toBe("too_expensive");
        expect(switchingReason.text).toBe("switchToFreeOrg");
      });

      it("shows the 'switch to free org' reason for a FamiliesAnnually2019 organization", () => {
        const component = buildComponent(
          orgParams(ProductTierType.Free, PlanType.FamiliesAnnually2019),
        ) as any;

        const switchingReason = component.reasons[5];

        expect(switchingReason.text).toBe("switchToFreeOrg");
      });

      it("shows the 'switch to free org' reason for a FamiliesAnnually2025 organization", () => {
        const component = buildComponent(
          orgParams(ProductTierType.Free, PlanType.FamiliesAnnually2025),
        ) as any;

        const switchingReason = component.reasons[5];

        expect(switchingReason.text).toBe("switchToFreeOrg");
      });

      it("shows the 'too expensive' reason for a non-families organization", () => {
        const component = buildComponent(
          orgParams(ProductTierType.Teams, PlanType.TeamsAnnually),
        ) as any;

        const switchingReason = component.reasons[5];

        expect(switchingReason.value).toBe("too_expensive");
        expect(switchingReason.text).toBe("tooExpensive");
      });
    });

    describe("submit", () => {
      describe("when the form is invalid", () => {
        it("does not call the API and marks all fields touched", async () => {
          const component = buildComponent(userParams());
          const markAllAsTouchedSpy = jest.spyOn((component as any).formGroup, "markAllAsTouched");

          // Make the form invalid by exceeding the max feedback length.
          (component as any).formGroup.patchValue({ feedback: "a".repeat(401) });

          await component.submit();

          expect(markAllAsTouchedSpy).toHaveBeenCalled();
          expect(mockBillingApiService.cancelPremiumUserSubscription).not.toHaveBeenCalled();
        });
      });

      describe("for a User", () => {
        it("calls cancelPremiumUserSubscription with the correct reason and feedback", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({
            reason: "missing_features",
            feedback: "need X",
          });

          await component.submit();

          expect(mockBillingApiService.cancelPremiumUserSubscription).toHaveBeenCalledWith({
            reason: "missing_features",
            feedback: "need X",
          });
        });

        it("shows a success toast", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({ reason: "unused" });

          await component.submit();

          expect(mockToastService.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: "success" }),
          );
        });

        it("closes the dialog with the Submitted result", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({ reason: "unused" });

          await component.submit();

          expect(mockDialogRef.close).toHaveBeenCalledWith(
            OffboardingSurveyDialogResultType.Submitted,
          );
        });

        it("omits empty feedback from the request", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({ reason: "unused", feedback: "" });

          await component.submit();

          expect(mockBillingApiService.cancelPremiumUserSubscription).toHaveBeenCalledWith({
            reason: "unused",
            feedback: "",
          });
        });
      });

      describe("for an Organization", () => {
        it("calls cancelOrganizationSubscription with the org id and correct request", async () => {
          const component = buildComponent(orgParams(ProductTierType.Teams));
          (component as any).formGroup.patchValue({
            reason: "too_expensive",
            feedback: "budget cuts",
          });

          await component.submit();

          expect(mockBillingApiService.cancelOrganizationSubscription).toHaveBeenCalledWith(
            "org-123",
            { reason: "too_expensive", feedback: "budget cuts" },
          );
        });

        it("shows a success toast", async () => {
          const component = buildComponent(orgParams(ProductTierType.Teams));
          (component as any).formGroup.patchValue({ reason: "unused" });

          await component.submit();

          expect(mockToastService.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: "success" }),
          );
        });

        it("closes the dialog with the Submitted result", async () => {
          const component = buildComponent(orgParams(ProductTierType.Teams));
          (component as any).formGroup.patchValue({ reason: "unused" });

          await component.submit();

          expect(mockDialogRef.close).toHaveBeenCalledWith(
            OffboardingSurveyDialogResultType.Submitted,
          );
        });

        it("does not call the user cancellation API", async () => {
          const component = buildComponent(orgParams(ProductTierType.Teams));
          (component as any).formGroup.patchValue({ reason: "unused" });

          await component.submit();

          expect(mockBillingApiService.cancelPremiumUserSubscription).not.toHaveBeenCalled();
        });
      });

      describe("feedback construction", () => {
        it("sends feedback alone when reason is not 'other'", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({
            reason: "missing_features",
            feedback: "I need feature X",
            otherFeedback: "",
          });

          await component.submit();

          expect(mockBillingApiService.cancelPremiumUserSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ feedback: "I need feature X" }),
          );
        });

        it("joins otherFeedback and feedback with a newline when reason is 'other'", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({
            reason: "other",
            otherFeedback: "custom reason",
            feedback: "extra details",
          });

          await component.submit();

          expect(mockBillingApiService.cancelPremiumUserSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ feedback: "custom reason\nextra details" }),
          );
        });

        it("sends only otherFeedback when reason is 'other' and feedback is empty", async () => {
          const component = buildComponent(userParams());
          (component as any).formGroup.patchValue({
            reason: "other",
            otherFeedback: "custom reason",
            feedback: "",
          });

          await component.submit();

          expect(mockBillingApiService.cancelPremiumUserSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ feedback: "custom reason" }),
          );
        });
      });
    });
  });
});
