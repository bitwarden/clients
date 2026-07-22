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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import {
  SubscriberBillingClient,
  PreviewInvoiceClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { BillingNotificationService } from "../services/billing-notification.service";

import { ChangePlanDialogComponent } from "./change-plan-dialog.component";

describe("ChangePlanDialogComponent (additional service accounts)", () => {
  let component: ChangePlanDialogComponent;

  beforeEach(() => {
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
        { provide: PreviewInvoiceClient, useValue: mock<PreviewInvoiceClient>() },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
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

  describe("server-sourced total (PM-40440)", () => {
    let previewPlanChange: jest.Mock;

    // These assertions exercise the component class directly (matching the rest of this spec).
    // `estimatedTotal ?? total` is the exact expression both template total bindings now render.
    beforeEach(() => {
      previewPlanChange = (component as any).previewInvoiceClient
        .previewTaxForOrganizationSubscriptionPlanChange;
    });

    const setupPlanChange = ({ percentOff }: { percentOff?: number } = {}) => {
      component.organizationId = "organization-id";
      component.organization = { useSecretsManager: false } as any;
      component.selectedPlan = {
        type: PlanType.EnterpriseAnnually,
        productTier: ProductTierType.Enterprise,
        PasswordManager: {
          basePrice: 300,
          hasAdditionalSeatsOption: false,
          hasPremiumAccessOption: false,
          hasAdditionalStorageOption: false,
        },
      } as any;
      component.sub = { customerDiscount: percentOff ? { percentOff } : undefined } as any;
      // A saved billing address lets refreshSalesTax() run past its early-return guard.
      component.billingAddress = { country: "US", postalCode: "12345" } as any;
    };

    it("stores the server-computed total returned by the preview", async () => {
      setupPlanChange();
      previewPlanChange.mockResolvedValue({ tax: 10, total: 330 });

      await (component as any).refreshSalesTax();

      expect((component as any).estimatedTax).toBe(10);
      expect((component as any).estimatedTotal).toBe(330);
    });

    it("displays the full server total for a migrating org, not the coupon-discounted client total", async () => {
      // Org carries a leaked 20% migration coupon surfaced as customerDiscount.
      setupPlanChange({ percentOff: 20 });
      // The server preview returns the true, undiscounted Enterprise total.
      previewPlanChange.mockResolvedValue({ tax: 0, total: 300 });

      await (component as any).refreshSalesTax();

      const displayedTotal = (component as any).estimatedTotal ?? component.total;
      expect(displayedTotal).toBe(300);
      expect(displayedTotal).not.toBe(component.total * 0.8);
    });

    it("keeps the displayed total equal to the client total for a non-discounted org", async () => {
      setupPlanChange();
      previewPlanChange.mockResolvedValue({ tax: 0, total: 300 });

      await (component as any).refreshSalesTax();

      const displayedTotal = (component as any).estimatedTotal ?? component.total;
      expect(displayedTotal).toBe(component.total);
      expect(displayedTotal).toBe(300);
    });

    it("falls back to the client total when the preview fails, without throwing", async () => {
      setupPlanChange();
      (component as any).estimatedTotal = 999;
      // A current plan distinct from the selected plan lets selectPlan() reach refreshSalesTax().
      component.currentPlan = { productTier: ProductTierType.Teams } as any;
      previewPlanChange.mockRejectedValue(new Error("preview failed"));

      await expect((component as any).selectPlan(component.selectedPlan)).resolves.toBeUndefined();

      expect((component as any).estimatedTotal).toBeUndefined();
      expect((component as any).estimatedTax).toBe(0);
    });

    it("no longer exposes the client-side applied-discount calculation the provider-discount rows used", () => {
      expect((component as any).calculateTotalAppliedDiscount).toBeUndefined();
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
      // Trial seat line shows "Free for 1 year"; passwordManagerSeatTotal is zeroed.
      expect(component.passwordManagerSeatTotal(component.selectedPlan)).toBe(0);
    });

    it("does not report an SM trial for a deferred price-migration (schedule) discount", () => {
      setupDiscount(true);

      // Guard short-circuits even though appliesTo matches a subscription product.
      expect(component.isSecretsManagerTrial()).toBe(false);
      // Non-trial seat line renders the real seat total (10 seats × $4), not "Free for 1 year".
      expect(component.passwordManagerSeatTotal(component.selectedPlan)).toBe(40);
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
