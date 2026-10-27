import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { OrganizationBillingClient } from "../clients";

import {
  PrivilegedControlsAdjustSubscriptionComponent,
  PrivilegedControlsSubscriptionOptions,
} from "./privileged-controls-adjust-subscription.component";

describe("PrivilegedControlsAdjustSubscriptionComponent", () => {
  let fixture: ComponentFixture<PrivilegedControlsAdjustSubscriptionComponent>;
  let component: PrivilegedControlsAdjustSubscriptionComponent;
  let organizationBillingClient: jest.Mocked<OrganizationBillingClient>;
  let toastService: jest.Mocked<ToastService>;
  let validationService: jest.Mocked<ValidationService>;
  let adjustedSpy: jest.Mock;

  const organizationId = "org-123" as OrganizationId;

  const buildOptions = (
    overrides: Partial<PrivilegedControlsSubscriptionOptions> = {},
  ): PrivilegedControlsSubscriptionOptions => ({
    interval: "year",
    seatCount: 15,
    maxAutoscaleSeats: undefined,
    passwordManagerSeats: 20,
    passwordManagerMaxAutoscaleSeats: undefined,
    seatPrice: 5,
    ...overrides,
  });

  const formGroup = () => component["formGroup"];

  const render = async (options: PrivilegedControlsSubscriptionOptions = buildOptions()) => {
    fixture.componentRef.setInput("organizationId", organizationId);
    fixture.componentRef.setInput("options", options);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const setValue = (value: Partial<ReturnType<ReturnType<typeof formGroup>["getRawValue"]>>) => {
    formGroup().patchValue(value);
    fixture.detectChanges();
  };

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, " ");

  const submitForm = async () => {
    fixture.nativeElement.querySelector("form").dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    organizationBillingClient = mock<OrganizationBillingClient>();
    organizationBillingClient.updatePrivilegedControlsSubscription.mockResolvedValue();
    toastService = mock<ToastService>();
    validationService = mock<ValidationService>();

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string, ...args: unknown[]) => {
      const values = args.filter((arg) => arg != null);
      return values.length > 0 ? `${key}:${values.join(",")}` : key;
    });

    await TestBed.configureTestingModule({
      imports: [PrivilegedControlsAdjustSubscriptionComponent],
      providers: [
        { provide: OrganizationBillingClient, useValue: organizationBillingClient },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: ValidationService, useValue: validationService },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivilegedControlsAdjustSubscriptionComponent);
    component = fixture.componentInstance;
    adjustedSpy = jest.fn();
    component.adjusted.subscribe(adjustedSpy);
  });

  describe("form initialization", () => {
    it("patches the form from the options without a seat limit", async () => {
      await render();

      expect(formGroup().getRawValue()).toEqual({
        seatCount: 15,
        limitSeats: false,
        maxAutoscaleSeats: null,
      });
      expect(formGroup().controls.maxAutoscaleSeats.disabled).toBe(true);
      expect(
        fixture.nativeElement.querySelector("#privileged-controls-adjust_input_seat-limit"),
      ).toBeNull();
    });

    it("patches the form from the options with a seat limit", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));

      expect(formGroup().getRawValue()).toEqual({
        seatCount: 15,
        limitSeats: true,
        maxAutoscaleSeats: 25,
      });
      expect(formGroup().controls.maxAutoscaleSeats.enabled).toBe(true);
      expect(
        fixture.nativeElement.querySelector("#privileged-controls-adjust_input_seat-limit"),
      ).not.toBeNull();
    });

    it("re-patches the form when the options change", async () => {
      await render();
      setValue({ seatCount: 18 });

      fixture.componentRef.setInput(
        "options",
        buildOptions({ seatCount: 20, maxAutoscaleSeats: 30 }),
      );
      fixture.detectChanges();

      expect(formGroup().getRawValue()).toEqual({
        seatCount: 20,
        limitSeats: true,
        maxAutoscaleSeats: 30,
      });
    });
  });

  describe("seat cap", () => {
    it("requires at least one seat", async () => {
      await render(buildOptions({ seatCount: 15 }));

      setValue({ seatCount: 0 });
      expect(formGroup().controls.seatCount.hasError("min")).toBe(true);

      setValue({ seatCount: 1 });
      expect(formGroup().controls.seatCount.valid).toBe(true);
    });

    it("rejects more seats than the Password Manager seat count", async () => {
      await render(buildOptions({ seatCount: 15, passwordManagerSeats: 20 }));

      setValue({ seatCount: 21 });
      expect(formGroup().controls.seatCount.hasError("max")).toBe(true);

      setValue({ seatCount: 20 });
      expect(formGroup().controls.seatCount.valid).toBe(true);
    });

    it("requires a seat count", async () => {
      await render();

      setValue({ seatCount: null });

      expect(formGroup().controls.seatCount.hasError("required")).toBe(true);
    });

    it("rejects a fractional seat count", async () => {
      await render();

      setValue({ seatCount: 12.5 });

      expect(formGroup().controls.seatCount.errors).toEqual({
        wholeNumber: { message: "integerInputError" },
      });
    });

    it("renders the Password Manager seat count as the maximum hint", async () => {
      await render(buildOptions({ passwordManagerSeats: 20 }));

      expect(text()).toContain("maximumSeatsCount:20");
    });
  });

  describe("seat limit", () => {
    it("enables the seat limit field when the limit checkbox is checked", async () => {
      await render();

      setValue({ limitSeats: true });

      expect(formGroup().controls.maxAutoscaleSeats.enabled).toBe(true);
      expect(formGroup().controls.maxAutoscaleSeats.hasError("required")).toBe(true);
      expect(
        fixture.nativeElement.querySelector("#privileged-controls-adjust_input_seat-limit"),
      ).not.toBeNull();
    });

    it("disables the seat limit field when the limit checkbox is unchecked", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));

      setValue({ limitSeats: false });

      expect(formGroup().controls.maxAutoscaleSeats.disabled).toBe(true);
      expect(
        fixture.nativeElement.querySelector("#privileged-controls-adjust_input_seat-limit"),
      ).toBeNull();
    });

    it("rejects a seat limit below the seat count", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));

      setValue({ seatCount: 20, maxAutoscaleSeats: 15 });

      expect(formGroup().controls.maxAutoscaleSeats.hasError("min")).toBe(true);
      expect(formGroup().invalid).toBe(true);
    });

    it("rejects a fractional seat limit", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));

      setValue({ seatCount: 20, maxAutoscaleSeats: 20.5 });

      expect(formGroup().controls.maxAutoscaleSeats.hasError("wholeNumber")).toBe(true);
      expect(formGroup().invalid).toBe(true);
    });

    it("re-validates the seat limit as soon as the seat count changes", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 20 }));
      expect(formGroup().controls.maxAutoscaleSeats.valid).toBe(true);

      setValue({ seatCount: 21 });

      expect(formGroup().controls.maxAutoscaleSeats.hasError("min")).toBe(true);
    });

    it("forces the seat limit on when Password Manager has a limit", async () => {
      await render(
        buildOptions({ maxAutoscaleSeats: undefined, passwordManagerMaxAutoscaleSeats: 30 }),
      );

      expect(formGroup().getRawValue().limitSeats).toBe(true);
      expect(formGroup().controls.limitSeats.disabled).toBe(true);
      expect(formGroup().controls.maxAutoscaleSeats.enabled).toBe(true);
      expect(formGroup().controls.maxAutoscaleSeats.hasError("required")).toBe(true);
      expect(component["unchanged"]()).toBe(false);
      expect(text()).toContain("maximumSeatsCount:30");
    });

    it("rejects a seat limit above the Password Manager limit", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25, passwordManagerMaxAutoscaleSeats: 30 }));

      setValue({ maxAutoscaleSeats: 31 });
      expect(formGroup().controls.maxAutoscaleSeats.hasError("max")).toBe(true);

      setValue({ maxAutoscaleSeats: 30 });
      expect(formGroup().controls.maxAutoscaleSeats.valid).toBe(true);
    });

    it("leaves the seat limit optional when Password Manager has no limit", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));

      expect(formGroup().controls.limitSeats.enabled).toBe(true);

      setValue({ limitSeats: false });

      expect(formGroup().valid).toBe(true);
    });
  });

  describe("cost hints", () => {
    it("renders the annual seat total", async () => {
      await render();

      setValue({ seatCount: 12 });

      expect(text()).toContain("12 × $5.00 = $60.00 / year");
    });

    it("renders the monthly seat total", async () => {
      await render(buildOptions({ interval: "month", seatPrice: 3 }));

      setValue({ seatCount: 12 });

      expect(text()).toContain("12 × $3.00 = $36.00 / month");
    });

    it("renders the maximum seat cost for the seat limit", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 20 }));

      expect(text()).toContain("maxSeatCost: 20 × $5.00 = $100.00 / year");
    });
  });

  describe("unchanged form", () => {
    const saveDisabled = () =>
      fixture.nativeElement
        .querySelector("#privileged-controls-adjust_button_save")
        .getAttribute("aria-disabled") === "true";

    it("disables Save until a value differs from the saved subscription", async () => {
      await render(buildOptions({ seatCount: 15, maxAutoscaleSeats: 20 }));
      expect(saveDisabled()).toBe(true);

      setValue({ seatCount: 16 });
      expect(saveDisabled()).toBe(false);

      setValue({ seatCount: 15 });
      expect(saveDisabled()).toBe(true);

      setValue({ maxAutoscaleSeats: 25 });
      expect(saveDisabled()).toBe(false);

      setValue({ maxAutoscaleSeats: 20, limitSeats: false });
      expect(saveDisabled()).toBe(false);
    });

    it("treats toggling the limit on as a change", async () => {
      await render(buildOptions({ maxAutoscaleSeats: undefined }));
      expect(saveDisabled()).toBe(true);

      setValue({ limitSeats: true });

      expect(saveDisabled()).toBe(false);
    });

    it("does not submit or toast when nothing has changed", async () => {
      await render(buildOptions({ seatCount: 15, maxAutoscaleSeats: 20 }));

      await submitForm();

      expect(organizationBillingClient.updatePrivilegedControlsSubscription).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(adjustedSpy).not.toHaveBeenCalled();
    });
  });

  describe("submit", () => {
    it("submits the seat change relative to the current seat count with the seat limit", async () => {
      await render();
      setValue({ seatCount: 12, limitSeats: true, maxAutoscaleSeats: 20 });

      await submitForm();

      expect(organizationBillingClient.updatePrivilegedControlsSubscription).toHaveBeenCalledWith(
        organizationId,
        { seatAdjustment: -3, maxAutoscaleSeats: 20 },
      );
    });

    it("submits a positive adjustment when seats are added", async () => {
      await render();
      setValue({ seatCount: 20 });

      await submitForm();

      expect(organizationBillingClient.updatePrivilegedControlsSubscription).toHaveBeenCalledWith(
        organizationId,
        { seatAdjustment: 5, maxAutoscaleSeats: null },
      );
    });

    it("submits a zero adjustment when only the seat limit changes", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));
      setValue({ maxAutoscaleSeats: 30 });

      await submitForm();

      expect(organizationBillingClient.updatePrivilegedControlsSubscription).toHaveBeenCalledWith(
        organizationId,
        { seatAdjustment: 0, maxAutoscaleSeats: 30 },
      );
    });

    it("submits a null seat limit when the limit checkbox is unchecked", async () => {
      await render(buildOptions({ maxAutoscaleSeats: 25 }));
      setValue({ seatCount: 12, limitSeats: false });

      await submitForm();

      expect(organizationBillingClient.updatePrivilegedControlsSubscription).toHaveBeenCalledWith(
        organizationId,
        { seatAdjustment: -3, maxAutoscaleSeats: null },
      );
    });

    it("shows a success toast and emits adjusted once on success", async () => {
      await render();
      setValue({ seatCount: 12 });

      await submitForm();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "subscriptionUpdated",
      });
      expect(adjustedSpy).toHaveBeenCalledTimes(1);
    });

    it("surfaces server errors through bitSubmit and keeps the form values", async () => {
      const error = new ErrorResponse(
        { Message: "Privileged Controls requires at least 10 seats." },
        400,
      );
      organizationBillingClient.updatePrivilegedControlsSubscription.mockRejectedValue(error);
      await render();
      setValue({ seatCount: 11 });

      await submitForm();

      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(adjustedSpy).not.toHaveBeenCalled();
      expect(formGroup().getRawValue().seatCount).toBe(11);
    });

    it("does not call the server when the form is invalid", async () => {
      await render();
      setValue({ seatCount: 0 });

      await submitForm();

      expect(organizationBillingClient.updatePrivilegedControlsSubscription).not.toHaveBeenCalled();
      expect(adjustedSpy).not.toHaveBeenCalled();
    });
  });
});
