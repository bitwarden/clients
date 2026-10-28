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
      PrivilegedControls: { seatPrice: overrides.seatPrice ?? 120 },
    }) as PlanResponse;

  const createComponent = (options?: {
    plan?: PlanResponse;
    customerDiscount?: BillingCustomerDiscount | null;
    passwordManagerSeats?: number;
    passwordManagerMaxAutoscaleSeats?: number | null;
  }) => {
    fixture = TestBed.createComponent(PrivilegedControlsPurchaseComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("plan", options?.plan ?? buildPlan());
    fixture.componentRef.setInput("organizationId", organizationId);
    fixture.componentRef.setInput("customerDiscount", options?.customerDiscount ?? null);
    fixture.componentRef.setInput("passwordManagerSeats", options?.passwordManagerSeats ?? 50);
    fixture.componentRef.setInput(
      "passwordManagerMaxAutoscaleSeats",
      options?.passwordManagerMaxAutoscaleSeats ?? null,
    );
    fixture.detectChanges();
  };

  const form = () => component["formGroup"];

  const enableAndFill = (seats: number, maxAutoscaleSeats: number | null) => {
    component["enabledControl"].setValue(true);
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
    it("defaults seats to 1", () => {
      createComponent();
      expect(form().controls.seats.value).toBe(1);
    });

    it("accepts 1 seat", () => {
      createComponent();
      enableAndFill(1, null);
      expect(form().controls.seats.valid).toBe(true);
    });

    it("rejects zero seats", () => {
      createComponent();
      enableAndFill(0, null);
      expect(form().controls.seats.hasError("min")).toBe(true);
    });

    it("accepts seats equal to the Password Manager seat count", () => {
      createComponent({ passwordManagerSeats: 50 });
      enableAndFill(50, null);
      expect(form().controls.seats.valid).toBe(true);
    });

    it("rejects seats above the Password Manager seat count", () => {
      createComponent({ passwordManagerSeats: 50 });
      enableAndFill(51, null);
      expect(form().controls.seats.getError("seatsAbovePasswordManagerSeats")).toEqual({
        message: "privilegedControlsSeatsAbovePasswordManagerSeats",
      });
    });

    it("rejects seats above 100,000", () => {
      createComponent();
      enableAndFill(100001, null);
      expect(form().controls.seats.hasError("max")).toBe(true);
    });

    it("rejects decimal seats", () => {
      createComponent();
      enableAndFill(10.5, null);
      expect(form().controls.seats.hasError("wholeNumber")).toBe(true);
    });

    it("requires seats", () => {
      createComponent();
      enableAndFill(null, null);
      expect(form().controls.seats.hasError("required")).toBe(true);
    });

    it("accepts a seat limit above seats", () => {
      createComponent();
      enableAndFill(12, 13);
      expect(form().controls.maxAutoscaleSeats.hasError("maxAutoscaleSeatsNotAboveSeats")).toBe(
        false,
      );
    });

    it("rejects a seat limit equal to seats", () => {
      createComponent();
      enableAndFill(12, 12);
      expect(form().controls.maxAutoscaleSeats.getError("maxAutoscaleSeatsNotAboveSeats")).toEqual({
        message: "privilegedControlsSeatLimitNotAboveSeats",
      });
    });

    it("rejects a negative seat limit", () => {
      createComponent();
      enableAndFill(12, -5);
      expect(form().controls.maxAutoscaleSeats.hasError("maxAutoscaleSeatsNotAboveSeats")).toBe(
        true,
      );
    });

    it("rejects a decimal seat limit", () => {
      createComponent();
      enableAndFill(12, 20.5);
      expect(form().controls.maxAutoscaleSeats.hasError("wholeNumber")).toBe(true);
    });

    it("caps the seat limit at the Password Manager seat limit when one is set", () => {
      createComponent({ passwordManagerSeats: 50, passwordManagerMaxAutoscaleSeats: 30 });
      enableAndFill(12, 30);
      expect(form().controls.maxAutoscaleSeats.valid).toBe(true);

      form().controls.maxAutoscaleSeats.setValue(31);
      expect(
        form().controls.maxAutoscaleSeats.getError("maxAutoscaleSeatsAbovePasswordManager"),
      ).toEqual({
        message: "privilegedControlsSeatLimitAbovePasswordManagerSeatLimit",
      });
    });

    it("caps the seat limit at the Password Manager seat count when there is no Password Manager seat limit", () => {
      createComponent({ passwordManagerSeats: 50, passwordManagerMaxAutoscaleSeats: null });
      enableAndFill(12, 50);
      expect(form().controls.maxAutoscaleSeats.valid).toBe(true);

      form().controls.maxAutoscaleSeats.setValue(51);
      expect(
        form().controls.maxAutoscaleSeats.getError("maxAutoscaleSeatsAbovePasswordManager"),
      ).toEqual({
        message: "privilegedControlsSeatLimitAbovePasswordManagerSeats",
      });
    });

    it("flags the seat limit when seats are raised to it", () => {
      createComponent();
      enableAndFill(12, 13);

      form().controls.seats.setValue(13);
      expect(form().controls.maxAutoscaleSeats.hasError("maxAutoscaleSeatsNotAboveSeats")).toBe(
        true,
      );
    });

    it("clears the seat limit error when seats are lowered below it", () => {
      createComponent();
      enableAndFill(12, 12);

      form().controls.seats.setValue(11);
      expect(form().controls.maxAutoscaleSeats.valid).toBe(true);
    });

    it("keeps the seat limit's own errors when the seats comparison passes", () => {
      createComponent({ passwordManagerSeats: 50 });
      enableAndFill(12, 51);

      form().controls.seats.setValue(10);
      expect(
        form().controls.maxAutoscaleSeats.hasError("maxAutoscaleSeatsAbovePasswordManager"),
      ).toBe(true);
    });

    it("hides the seat fields until Privileged Controls is checked", () => {
      createComponent();

      expect(
        fixture.nativeElement.querySelector("#privileged-controls-purchase_input_seats"),
      ).toBeNull();

      fixture.nativeElement.querySelector("#privileged-controls-purchase_input_enabled").click();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector("#privileged-controls-purchase_input_seats"),
      ).not.toBeNull();
    });

    it("shows a hint under the seat limit field", () => {
      createComponent();
      fixture.nativeElement.querySelector("#privileged-controls-purchase_input_enabled").click();
      fixture.detectChanges();

      const maxAutoscaleSeatsInput: HTMLElement = fixture.nativeElement.querySelector(
        "#privileged-controls-purchase_input_seat-limit",
      );
      expect(maxAutoscaleSeatsInput.closest("bit-form-field")?.textContent).toContain(
        "privilegedControlsSeatLimitDesc",
      );
    });
  });

  describe("max seat cost", () => {
    it("multiplies the seat limit by the plan seat price", () => {
      createComponent();
      enableAndFill(12, 20);
      expect(component["maxSeatTotal"]()).toBe(2400);
    });

    it("applies an active percentage discount", () => {
      createComponent({
        customerDiscount: { active: true, percentOff: 20 } as BillingCustomerDiscount,
      });
      enableAndFill(12, 20);
      expect(component["maxSeatTotal"]()).toBe(1920);
    });

    it("is zero when the seat limit is empty", () => {
      createComponent();
      enableAndFill(12, null);
      expect(component["maxSeatTotal"]()).toBe(0);
    });

    it("uses the plan billing interval", () => {
      createComponent({ plan: buildPlan({ isAnnual: false, seatPrice: 11 }) });
      expect(component["interval"]()).toBe("month");
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

    it("does not purchase when seats are above the Password Manager seat count", async () => {
      createComponent({ passwordManagerSeats: 50 });
      enableAndFill(51, null);

      await component["submit"]();

      expect(billingClient.purchasePrivilegedControls).not.toHaveBeenCalled();
    });

    it("does not purchase when the seat limit is not above seats", async () => {
      createComponent();
      enableAndFill(12, 12);

      await component["submit"]();

      expect(billingClient.purchasePrivilegedControls).not.toHaveBeenCalled();
    });

    it("does not purchase when seats are a decimal", async () => {
      createComponent();
      enableAndFill(10.5, null);

      await component["submit"]();

      expect(billingClient.purchasePrivilegedControls).not.toHaveBeenCalled();
    });

    it("does not purchase when seats are empty", async () => {
      createComponent();
      enableAndFill(null, null);

      await component["submit"]();

      expect(billingClient.purchasePrivilegedControls).not.toHaveBeenCalled();
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
