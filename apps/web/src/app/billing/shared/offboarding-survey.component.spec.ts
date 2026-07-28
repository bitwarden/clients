import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductTierType } from "@bitwarden/common/billing/enums/product-tier-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import {
  OffboardingSurveyComponent,
  OffboardingSurveyDialogParams,
  OffboardingSurveyDialogResultType,
} from "./offboarding-survey.component";

describe("OffboardingSurveyComponent", () => {
  const mockDialogRef = mock<DialogRef<OffboardingSurveyDialogResultType>>();
  const mockBillingApiService = mock<BillingApiService>();
  const mockI18nService = mock<I18nService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockToastService = mock<ToastService>();

  const buildComponent = (params: OffboardingSurveyDialogParams) => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        OffboardingSurveyComponent,
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: BillingApiService, useValue: mockBillingApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: ToastService, useValue: mockToastService },
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
        (component as any).formGroup.patchValue({ reason: "missing_features", feedback: "need X" });

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
