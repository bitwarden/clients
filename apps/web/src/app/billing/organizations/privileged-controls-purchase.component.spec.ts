import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { BillingCustomerDiscount } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { OrganizationBillingClient } from "../clients/organization-billing.client";

import { PrivilegedControlsPurchaseComponent } from "./privileged-controls-purchase.component";

describe("PrivilegedControlsPurchaseComponent", () => {
  let fixture: ComponentFixture<PrivilegedControlsPurchaseComponent>;
  let component: PrivilegedControlsPurchaseComponent;
  let billingClient: jest.Mocked<OrganizationBillingClient>;
  let syncService: jest.Mocked<SyncService>;
  let toastService: jest.Mocked<ToastService>;

  const organizationId = "org-id" as OrganizationId;

  const buildPlan = (overrides: { isAnnual?: boolean; seatPrice?: number } = {}): PlanResponse =>
    ({
      isAnnual: overrides.isAnnual ?? true,
      PrivilegedControls: { seatPrice: overrides.seatPrice ?? 120, defaultSeatMinimum: 10 },
    }) as PlanResponse;

  const createComponent = (options?: {
    plan?: PlanResponse;
    customerDiscount?: BillingCustomerDiscount | null;
  }) => {
    fixture = TestBed.createComponent(PrivilegedControlsPurchaseComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("plan", options?.plan ?? buildPlan());
    fixture.componentRef.setInput("organizationId", organizationId);
    fixture.componentRef.setInput("customerDiscount", options?.customerDiscount ?? null);
    fixture.detectChanges();
  };

  const form = () => component["formGroup"];

  const enableAndFill = (seats: number, maxAutoscaleSeats: number | null) => {
    form().controls.enabled.setValue(true);
    form().controls.seats.setValue(seats);
    form().controls.maxAutoscaleSeats.setValue(maxAutoscaleSeats);
  };

  beforeEach(async () => {
    billingClient = mock<OrganizationBillingClient>();
    syncService = mock<SyncService>();
    toastService = mock<ToastService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [PrivilegedControlsPurchaseComponent],
      providers: [
        { provide: OrganizationBillingClient, useValue: billingClient },
        { provide: SyncService, useValue: syncService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();
  });

  describe("price", () => {
    it("shows the monthly price for an annual plan", () => {
      createComponent();
      expect(component["monthlyCostPerSeat"]()).toBe(10);
    });

    it("shows the plan price for a monthly plan", () => {
      createComponent({ plan: buildPlan({ isAnnual: false, seatPrice: 11 }) });
      expect(component["monthlyCostPerSeat"]()).toBe(11);
    });

    it("applies an active percentage discount", () => {
      createComponent({
        customerDiscount: { active: true, percentOff: 20 } as BillingCustomerDiscount,
      });
      expect(component["monthlyCostPerSeat"]()).toBe(8);
    });

    it("ignores an inactive discount", () => {
      createComponent({
        customerDiscount: { active: false, percentOff: 20 } as BillingCustomerDiscount,
      });
      expect(component["monthlyCostPerSeat"]()).toBe(10);
    });
  });

  describe("form", () => {
    it("defaults seats to the minimum", () => {
      createComponent();
      expect(form().controls.seats.value).toBe(10);
    });

    it("accepts seats at the minimum and rejects one below", () => {
      createComponent();
      enableAndFill(10, null);
      expect(form().controls.seats.hasError("min")).toBe(false);

      form().controls.seats.setValue(9);
      expect(form().controls.seats.hasError("min")).toBe(true);
    });

    it("rejects seats above 100,000", () => {
      createComponent();
      enableAndFill(100001, null);
      expect(form().controls.seats.hasError("max")).toBe(true);
    });

    it("requires seats", () => {
      createComponent();
      enableAndFill(null, null);
      expect(form().controls.seats.hasError("required")).toBe(true);
    });

    it("accepts a seat limit equal to seats and rejects one below", () => {
      createComponent();
      enableAndFill(12, 12);
      expect(form().controls.maxAutoscaleSeats.hasError("seatLimitBelowSeats")).toBe(false);

      form().controls.maxAutoscaleSeats.setValue(11);
      expect(form().controls.maxAutoscaleSeats.hasError("seatLimitBelowSeats")).toBe(true);
    });

    it("flags the seat limit when seats are raised above it", () => {
      createComponent();
      enableAndFill(12, 12);

      form().controls.seats.setValue(13);
      expect(form().controls.maxAutoscaleSeats.hasError("seatLimitBelowSeats")).toBe(true);
    });
  });

  describe("submit", () => {
    it("sends the seats and seat limit on submit", async () => {
      createComponent();
      enableAndFill(15, 20);

      await component["submit"]();

      expect(billingClient.purchasePrivilegedControls).toHaveBeenCalledWith(organizationId, {
        seats: 15,
        maxAutoscaleSeats: 20,
      });
    });

    it("sends a null seat limit when the field is cleared", async () => {
      createComponent();
      enableAndFill(15, 20);
      form().controls.maxAutoscaleSeats.setValue(null);

      await component["submit"]();

      expect(billingClient.purchasePrivilegedControls).toHaveBeenCalledWith(organizationId, {
        seats: 15,
        maxAutoscaleSeats: null,
      });
    });

    it("shows a toast, syncs, and emits after a successful purchase", async () => {
      createComponent();
      const emitted = jest.fn();
      component.purchased.subscribe(emitted);
      enableAndFill(15, null);

      await component["submit"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "privilegedControlsPurchased" }),
      );
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it("does not toast, sync, or emit when the purchase fails", async () => {
      createComponent();
      const emitted = jest.fn();
      component.purchased.subscribe(emitted);
      const error = new Error("Your card was declined.");
      billingClient.purchasePrivilegedControls.mockRejectedValue(error);
      enableAndFill(15, null);

      await expect(component["submit"]()).rejects.toBe(error);

      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(syncService.fullSync).not.toHaveBeenCalled();
      expect(emitted).not.toHaveBeenCalled();
    });
  });
});
