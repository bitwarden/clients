import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { BillingNotificationService } from "../services/billing-notification.service";
import { InvoicePreviewService } from "../services/invoice-preview.service";

import { ChangePlanDialogComponent } from "./change-plan-dialog.component";

describe("ChangePlanDialogComponent (additional service accounts)", () => {
  let component: ChangePlanDialogComponent;
  let vfo1Enabled: jest.Mock<boolean, []>;
  let invoicePreviewService: jest.Mocked<InvoicePreviewService>;

  beforeEach(() => {
    vfo1Enabled = jest.fn<boolean, []>().mockReturnValue(false);

    invoicePreviewService = mock<InvoicePreviewService>();

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        ChangePlanDialogComponent,
        { provide: DIALOG_DATA, useValue: {} },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: LegacyCompatKeyService, useValue: mock<LegacyCompatKeyService>() },
        { provide: Router, useValue: mock<Router>() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        {
          provide: OrganizationApiServiceAbstraction,
          useValue: mock<OrganizationApiServiceAbstraction>(),
        },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: BillingNotificationService, useValue: mock<BillingNotificationService>() },
        { provide: SubscriberBillingClient, useValue: mock<SubscriberBillingClient>() },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
        { provide: Vfo1TerminologyService, useValue: { enabled: vfo1Enabled } },
        { provide: InvoicePreviewService, useValue: invoicePreviewService },
      ],
    });

    component = TestBed.inject(ChangePlanDialogComponent);
  });

  describe("get additionalServiceAccount", () => {
    // Reported PM-39805 org: 75 total entitlement, 20 static baseline. Grace varies per case.
    const setState = (grace: number | undefined) => {
      component.currentPlan = { SecretsManager: { baseServiceAccount: 20 } } as any;
      component.sub = { smServiceAccounts: 75, smServiceAccountsGrace: grace } as any;
    };

    it("subtracts permanent migration-grace accounts before pricing (75 - 20 - 30 = 25)", () => {
      setState(30);

      expect(component.additionalServiceAccount).toBe(25);
    });

    it("treats an absent grace value as zero (pre-server behavior: 75 - 20 = 55)", () => {
      setState(undefined);

      expect(component.additionalServiceAccount).toBe(55);
    });

    it("treats grace = 0 the same as no grace (75 - 20 = 55)", () => {
      setState(0);

      expect(component.additionalServiceAccount).toBe(55);
    });

    it("clamps to zero when grace exceeds the billable count (bad server data: 75 - 20 - 80)", () => {
      setState(80);

      expect(component.additionalServiceAccount).toBe(0);
    });

    it("returns 0 when the current plan has no Secrets Manager", () => {
      component.currentPlan = { SecretsManager: null } as any;
      component.sub = { smServiceAccounts: 75, smServiceAccountsGrace: 30 } as any;

      expect(component.additionalServiceAccount).toBe(0);
    });
  });

  describe("resolveHeaderName (VFO1 terminology)", () => {
    let i18nService: jest.Mocked<I18nService>;

    beforeEach(() => {
      i18nService = (component as any).i18nService as jest.Mocked<I18nService>;
      i18nService.t.mockImplementation((key: string) => key);
      (component as any).dialogParams.productTierType = ProductTierType.Teams;
    });

    it("uses the VFO1 terminology title when the flag is enabled", () => {
      vfo1Enabled.mockReturnValue(true);

      const result = component.resolveHeaderName({ subscription: null } as any);

      expect(result).toBe("upgradeYourPlan");
    });

    it("falls back to the legacy plan-specific title when the flag is disabled", () => {
      vfo1Enabled.mockReturnValue(false);

      const result = component.resolveHeaderName({ subscription: null } as any);

      expect(result).toBe("upgradeFreeOrganization");
      expect(i18nService.t).toHaveBeenCalledWith(
        "upgradeFreeOrganization",
        component.resolvePlanName(ProductTierType.Teams),
      );
    });
  });

  describe("buildSecretsManagerRequest (write path)", () => {
    it("submits the post-grace additional service account count", () => {
      component.organization = { useSecretsManager: true, seats: 5 } as any;
      // currentPlan is not Free, so the request takes the existing-subscription branch.
      component.currentPlan = {
        productTier: ProductTierType.Teams,
        SecretsManager: { baseServiceAccount: 20 },
      } as any;
      component.selectedPlan = { SecretsManager: { hasAdditionalSeatsOption: true } } as any;
      component.sub = {
        smSeats: 5,
        smServiceAccounts: 75,
        smServiceAccountsGrace: 30,
      } as any;

      const request = new OrganizationUpgradeRequest();
      (component as any).buildSecretsManagerRequest(request);

      expect(request.additionalServiceAccounts).toBe(25); // 75 - 20 - 30
      expect(request.additionalSmSeats).toBe(5);
    });

    it("does not set service accounts when the organization does not use Secrets Manager", () => {
      component.organization = { useSecretsManager: false } as any;
      component.currentPlan = {
        productTier: ProductTierType.Teams,
        SecretsManager: { baseServiceAccount: 20 },
      } as any;
      component.selectedPlan = { SecretsManager: { hasAdditionalSeatsOption: true } } as any;
      component.sub = { smServiceAccounts: 75, smServiceAccountsGrace: 30 } as any;

      const request = new OrganizationUpgradeRequest();
      (component as any).buildSecretsManagerRequest(request);

      expect(request.useSecretsManager).toBe(false);
      expect(request.additionalServiceAccounts).toBeUndefined();
    });
  });

  describe("preview-driven cart", () => {
    const address = {
      country: "US",
      postalCode: "12345",
      taxId: { code: "us_ein", value: "12-3456789" },
    } as any;

    const selectEnterpriseAnnual = () => {
      component.organizationId = "organization-id";
      component.selectedPlan = { type: PlanType.EnterpriseAnnually } as any;
      component.billingAddress = address;
    };

    it("builds the plan-change request from the selected plan and saved billing address", () => {
      selectEnterpriseAnnual();

      const request = (component as any).buildPlanChangePreviewRequest();

      expect(request).toEqual({
        tier: "enterprise",
        cadence: "annually",
        billingAddress: {
          country: "US",
          postalCode: "12345",
          taxId: { code: "us_ein", value: "12-3456789" },
        },
      });
    });

    it("returns no request when the address form is invalid and none is saved", () => {
      component.selectedPlan = { type: PlanType.TeamsAnnually } as any;
      component.billingAddress = null;

      expect((component as any).buildPlanChangePreviewRequest()).toBeUndefined();
    });

    it("fetches the preview cart when the flag is on and a selection exists", () => {
      selectEnterpriseAnnual();
      const request = (component as any).buildPlanChangePreviewRequest();
      (component as any).planChangeRequest.set(request);

      TestBed.tick();

      expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledWith(
        "organization-id",
        request,
      );
    });

    it("does not refetch when a rebuilt request is identical", () => {
      selectEnterpriseAnnual();
      invoicePreviewService.previewPlanChangeCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();
      (component as any).refreshCostSummary();
      TestBed.tick();

      expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledTimes(1);
    });

    it("refetches when the request changes", () => {
      selectEnterpriseAnnual();
      invoicePreviewService.previewPlanChangeCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();
      component.selectedPlan = { type: PlanType.TeamsAnnually } as any;
      (component as any).refreshCostSummary();
      TestBed.tick();

      expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledTimes(2);
    });

    it("sets the preview request from the selection when the cost summary refreshes", () => {
      selectEnterpriseAnnual();

      (component as any).refreshCostSummary();

      expect((component as any).planChangeRequest()).toEqual({
        tier: "enterprise",
        cadence: "annually",
        billingAddress: {
          country: "US",
          postalCode: "12345",
          taxId: { code: "us_ein", value: "12-3456789" },
        },
      });
    });

    it("previews the plan-change cart for an active subscription", () => {
      selectEnterpriseAnnual();
      invoicePreviewService.previewPlanChangeCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();

      expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledWith(
        "organization-id",
        (component as any).planChangeRequest(),
      );
      expect(invoicePreviewService.previewRestartCart).not.toHaveBeenCalled();
    });

    it("previews the restart cart for a canceled subscription", () => {
      selectEnterpriseAnnual();
      component.sub = { subscription: { status: "canceled" } } as any;
      invoicePreviewService.previewRestartCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledWith("organization-id", {
        billingAddress: {
          country: "US",
          postalCode: "12345",
          taxId: { code: "us_ein", value: "12-3456789" },
        },
      });
      expect(invoicePreviewService.previewPlanChangeCart).not.toHaveBeenCalled();
    });

    it("previews the restart cart for a cancelled org downgraded to the Free tier", () => {
      selectEnterpriseAnnual();
      component.sub = { subscription: { cancelled: true, status: "active" } } as any;
      component.organization = { productTierType: ProductTierType.Free } as any;
      invoicePreviewService.previewRestartCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledWith("organization-id", {
        billingAddress: {
          country: "US",
          postalCode: "12345",
          taxId: { code: "us_ein", value: "12-3456789" },
        },
      });
      expect(invoicePreviewService.previewPlanChangeCart).not.toHaveBeenCalled();
    });

    it("previews the restart cart for a canceled org on a plan with no plan-change mapping", async () => {
      component.organizationId = "organization-id";
      component.selectedPlan = { type: PlanType.TeamsStarter } as any;
      component.billingAddress = address;
      component.sub = { subscription: { status: "canceled" } } as any;
      invoicePreviewService.previewRestartCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(1);
      expect((component as any).planChangeCart.hasValue()).toBe(true);
      expect((component as any).isSubmitDisabled).toBe(false);
    });

    it("does not refetch the restart cart when a rebuilt address is identical", () => {
      selectEnterpriseAnnual();
      component.sub = { subscription: { status: "canceled" } } as any;
      invoicePreviewService.previewRestartCart.mockResolvedValue({} as any);

      (component as any).refreshCostSummary();
      TestBed.tick();
      (component as any).refreshCostSummary();
      TestBed.tick();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(1);
    });

    it("disables submit until the preview has loaded", () => {
      (component as any).planChangeCart = { hasValue: () => false };

      expect((component as any).isSubmitDisabled).toBe(true);
    });

    it("enables submit once the preview has loaded", () => {
      (component as any).planChangeCart = { hasValue: () => true };

      expect((component as any).isSubmitDisabled).toBe(false);
    });

    it("holds the preview in a loading state (spinner shown, submit disabled) while the request is in flight", () => {
      selectEnterpriseAnnual();
      // A never-resolving preview keeps the resource loading so the spinner branch stays active.
      invoicePreviewService.previewPlanChangeCart.mockReturnValue(new Promise(() => {}));

      (component as any).refreshCostSummary();
      TestBed.tick();

      expect((component as any).planChangeCart.isLoading()).toBe(true);
      expect((component as any).planChangeCart.hasValue()).toBe(false);
      expect((component as any).isSubmitDisabled).toBe(true);
    });

    it("shows a toast and surfaces the error callout (submit disabled) when the preview request fails", async () => {
      selectEnterpriseAnnual();
      invoicePreviewService.previewPlanChangeCart.mockRejectedValue(new Error("preview failed"));
      const billingNotificationService = TestBed.inject(BillingNotificationService);
      const i18nService = (component as any).i18nService as jest.Mocked<I18nService>;
      i18nService.t.mockImplementation((key: string) => key);

      (component as any).refreshCostSummary();
      TestBed.tick();
      // Let the rejected loader settle, then flush the resource's status update.
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();

      expect(billingNotificationService.showError).toHaveBeenCalledWith(
        "invoicePreviewErrorMessage",
      );
      expect((component as any).planChangeCart.error()).toBeTruthy();
      expect((component as any).planChangeCart.hasValue()).toBe(false);
      expect((component as any).isSubmitDisabled).toBe(true);
      expect((component as any).previewErrorMessageKey).toBe("invoicePreviewErrorMessage");
    });

    it("shows a toast pointing at the billing details when the preview fails validation (400)", async () => {
      selectEnterpriseAnnual();
      invoicePreviewService.previewPlanChangeCart.mockRejectedValue(
        new ErrorResponse(
          {
            Message: "The model state is invalid.",
            ValidationErrors: {
              BillingAddress: [
                "Your location wasn't recognized. Please ensure your country and postal code are valid and try again.",
              ],
            },
          },
          400,
        ),
      );
      const billingNotificationService = TestBed.inject(BillingNotificationService);
      const i18nService = (component as any).i18nService as jest.Mocked<I18nService>;
      i18nService.t.mockImplementation((key: string) => key);

      (component as any).refreshCostSummary();
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();

      expect(billingNotificationService.showError).toHaveBeenCalledWith(
        "billingPreviewInvalidAddressError",
      );
      expect((component as any).previewErrorMessageKey).toBe("billingPreviewInvalidAddressError");
    });

    it("shows the generic message for a 400 that is not about the billing address", async () => {
      selectEnterpriseAnnual();
      invoicePreviewService.previewPlanChangeCart.mockRejectedValue(
        new ErrorResponse({ Message: "Your organization is already on this plan." }, 400),
      );
      const i18nService = (component as any).i18nService as jest.Mocked<I18nService>;
      i18nService.t.mockImplementation((key: string) => key);

      (component as any).refreshCostSummary();
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();

      expect((component as any).previewErrorMessageKey).toBe("invoicePreviewErrorMessage");
    });
  });

  describe("trial callouts", () => {
    it("flags a free-org upgrade to a plan that carries a trial", () => {
      component.currentPlan = { productTier: ProductTierType.Free } as any;
      component.selectedPlan = { trialPeriodDays: 7 } as any;

      expect((component as any).isFreeUpgradeWithTrial).toBe(true);
      expect((component as any).trialLengthDays).toBe(7);
    });

    it("does not flag a free-org upgrade when the plan has no trial", () => {
      component.currentPlan = { productTier: ProductTierType.Free } as any;
      component.selectedPlan = { trialPeriodDays: 0 } as any;

      expect((component as any).isFreeUpgradeWithTrial).toBe(false);
    });

    it("does not flag a paid-org plan change as a free upgrade", () => {
      component.currentPlan = { productTier: ProductTierType.Teams } as any;
      component.selectedPlan = { trialPeriodDays: 7 } as any;

      expect((component as any).isFreeUpgradeWithTrial).toBe(false);
    });

    it("reports the subscription as trialing from its status", () => {
      component.sub = { subscription: { status: "trialing" } } as any;
      expect((component as any).isTrialing).toBe(true);

      component.sub = { subscription: { status: "active" } } as any;
      expect((component as any).isTrialing).toBe(false);
    });

    it("counts the whole days left in an active trial", () => {
      const trialEndDate = new Date(Date.now() + 3.2 * 24 * 60 * 60 * 1000).toISOString();
      component.sub = { subscription: { status: "trialing", trialEndDate } } as any;

      expect((component as any).remainingTrialDays).toBe(4);
    });

    it("reports no remaining trial days when the subscription is not trialing", () => {
      const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      component.sub = { subscription: { status: "active", trialEndDate } } as any;

      expect((component as any).remainingTrialDays).toBe(0);
    });

    it("exposes the subscription's trial end date for the callout", () => {
      component.sub = { subscription: { trialEndDate: "2026-01-15" } } as any;

      expect((component as any).trialEndDate).toBe("2026-01-15");
    });

    it("uses the singular trial message on the final day", () => {
      const trialEndDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      component.sub = { subscription: { status: "trialing", trialEndDate } } as any;

      expect((component as any).remainingTrialDays).toBe(1);
      expect((component as any).trialRemainingMessageKey).toBe("planChangeTrialRemaining");
    });

    it("uses the plural trial message with more than one day left", () => {
      const trialEndDate = new Date(Date.now() + 3.2 * 24 * 60 * 60 * 1000).toISOString();
      component.sub = { subscription: { status: "trialing", trialEndDate } } as any;

      expect((component as any).trialRemainingMessageKey).toBe("planChangeTrialRemainingPlural");
    });
  });

  describe("isSecretsManagerTrial (PM-40440)", () => {
    // Org carries a product-scoped discount whose `appliesTo` matches a live subscription product.
    // Whether that reads as an SM trial now depends solely on where the discount originated.
    const setupDiscount = (isFromSchedule: boolean) => {
      component.selectedPlan = {
        PasswordManager: { hasAdditionalSeatsOption: true, seatPrice: 4 },
      } as any;
      component.organization = { useSecretsManager: true } as any;
      component.sub = {
        seats: 10,
        subscription: { items: [{ productId: "product-seat" }] },
        customerDiscount: { appliesTo: ["product-seat"], isFromSchedule },
      } as any;
    };

    it("still reports a genuine SM trial when the discount is not schedule-derived", () => {
      setupDiscount(false);

      expect(component.isSecretsManagerTrial()).toBe(true);
    });

    it("does not report an SM trial for a deferred price-migration (schedule) discount", () => {
      setupDiscount(true);

      // Guard short-circuits even though appliesTo matches a subscription product.
      expect(component.isSecretsManagerTrial()).toBe(false);
      // Template selects the non-trial summary layout, not the trial one.
      expect(component.organization.useSecretsManager && !component.isSecretsManagerTrial()).toBe(
        true,
      );
      expect(component.organization.useSecretsManager && component.isSecretsManagerTrial()).toBe(
        false,
      );
    });
  });
});
