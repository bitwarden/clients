import { CurrencyPipe } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { ChurnMitigationOfferResponseModel, OrganizationBillingClient } from "../clients";

import {
  ChurnMitigationOfferDialogComponent,
  ChurnMitigationOfferDialogParams,
} from "./churn-mitigation-offer-dialog.component";

describe("ChurnMitigationOfferDialogComponent", () => {
  const mockDialogRef = mock<DialogRef>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();
  const mockToastService = mock<ToastService>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();

  // The component injects CurrencyPipe via `inject()`, so it must be built through TestBed
  // (a plain `new` would fail the injection context). `discountLabel` reads only `params.offer`.
  const buildComponent = (offer: Partial<ChurnMitigationOfferResponseModel>, isAnnual = true) => {
    const params = {
      organizationId: "org-abc",
      offer: offer as ChurnMitigationOfferResponseModel,
      accessEndDate: null,
      planName: "Teams",
      nextChargeDate: null,
      isAnnual,
    } as ChurnMitigationOfferDialogParams;

    TestBed.configureTestingModule({
      providers: [
        ChurnMitigationOfferDialogComponent,
        CurrencyPipe,
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
      ],
    });

    return TestBed.inject(ChurnMitigationOfferDialogComponent);
  };

  // `discountLabel` is protected; the template reads it, so access it via bracket notation in tests.
  const discountLabel = (component: ChurnMitigationOfferDialogComponent): string =>
    (component as unknown as { discountLabel: string }).discountLabel;

  describe("discountLabel", () => {
    it("formats a percentage offer as a bare percentage", () => {
      const component = buildComponent({ percentOff: 15, amountOff: null, name: "15% Off" });

      expect(discountLabel(component)).toBe("15%");
    });

    it("formats a fixed-amount offer as bare USD (not the coupon name)", () => {
      const component = buildComponent({ percentOff: null, amountOff: 15, name: "$15 Off" });

      const label = discountLabel(component);

      expect(label).toBe("$15.00");
      // The doubled-word bug ("Get $15 Off off your subscription") must be gone.
      expect(label).not.toBe("$15 Off");
    });

    it("formats a non-integer fixed amount with two fraction digits", () => {
      const component = buildComponent({ percentOff: null, amountOff: 15.5, name: "$15.50 Off" });

      expect(discountLabel(component)).toBe("$15.50");
    });

    it("falls back to the coupon name when neither percent nor amount is set", () => {
      const component = buildComponent({ percentOff: null, amountOff: null, name: "Fallback" });

      expect(discountLabel(component)).toBe("Fallback");
    });

    it("returns the bare amount regardless of duration (duration is rendered separately)", () => {
      const component = buildComponent({
        percentOff: null,
        amountOff: 15,
        durationInMonths: 12,
        name: "$15 Off",
      });

      expect(discountLabel(component)).toBe("$15.00");
    });
  });

  describe("duration", () => {
    beforeEach(() => {
      mockI18nService.t.mockImplementation((key: string) => key);
    });

    const build = (durationInMonths: number | null, isAnnual = true) =>
      buildComponent({ percentOff: 15, durationInMonths, name: "Churn" }, isAnnual) as any;

    // BUG-5: a `once` coupon (durationInMonths == null) covers a single billing period, so the
    // unit must follow the subscription interval instead of always reading "year".
    it("localizes a `once` coupon on an annual subscription as a single year", () => {
      const component = build(null, true);

      expect(component.durationUnit).toBe("year");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("year");
    });

    it("localizes a `once` coupon on a monthly subscription as a single month", () => {
      const component = build(null, false);

      expect(component.durationUnit).toBe("month");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("month");
    });

    it("localizes a 12-month coupon as a single year", () => {
      const component = build(12);

      expect(component.durationUnit).toBe("year");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("year");
    });

    it("localizes a 24-month coupon as multiple years", () => {
      const component = build(24);

      expect(component.durationUnit).toBe("years");
      expect(component.durationLength).toBe("2");
      expect(component.durationDescription).toBe("2 years");
    });

    it("localizes a 1-month coupon as a single month", () => {
      const component = build(1);

      expect(component.durationUnit).toBe("month");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("month");
    });

    it("localizes a multi-month coupon as plural months", () => {
      const component = build(3);

      expect(component.durationUnit).toBe("months");
      expect(component.durationLength).toBe("3");
      expect(component.durationDescription).toBe("3 months");
    });
  });

  // `isRecurringAmount` is protected; reach it via bracket notation for assertions.
  const isRecurringAmount = (component: ChurnMitigationOfferDialogComponent): boolean =>
    (component as unknown as { isRecurringAmount: boolean }).isRecurringAmount;

  describe("isRecurringAmount", () => {
    it("is true for a fixed amount that repeats", () => {
      const component = buildComponent({
        percentOff: null,
        amountOff: 15,
        duration: "repeating",
        durationInMonths: 12,
        name: "$15 Off",
      });

      expect(isRecurringAmount(component)).toBe(true);
    });

    it("is false for a fixed amount applied once", () => {
      const component = buildComponent({
        percentOff: null,
        amountOff: 15,
        duration: "once",
        durationInMonths: null,
        name: "$15 Off",
      });

      expect(isRecurringAmount(component)).toBe(false);
    });

    it("is false for a percentage that repeats", () => {
      const component = buildComponent({
        percentOff: 15,
        amountOff: null,
        duration: "repeating",
        durationInMonths: 12,
        name: "15% Off",
      });

      expect(isRecurringAmount(component)).toBe(false);
    });

    it("is false for a percentage applied once", () => {
      const component = buildComponent({
        percentOff: 15,
        amountOff: null,
        duration: "once",
        durationInMonths: null,
        name: "15% Off",
      });

      expect(isRecurringAmount(component)).toBe(false);
    });
  });

  // The branch logic that selects per-period vs. existing copy lives in the template, so these
  // assertions render the component and inspect which i18n key + args the pipe was asked for.
  // The i18n mock echoes "key|arg1|arg2|..." so we assert the key and args without coupling to
  // the (design-pending) English copy.
  describe("template copy", () => {
    let fixture: ComponentFixture<ChurnMitigationOfferDialogComponent>;

    const renderRecurringAmount = (isAnnual: boolean) => {
      mockI18nService.t.mockImplementation((key: string, ...args: (string | number)[]) =>
        [key, ...args].join("|"),
      );
      buildComponent(
        {
          percentOff: null,
          amountOff: 15,
          duration: "repeating",
          durationInMonths: 12,
          name: "$15 Off",
        },
        isAnnual,
      );
      fixture = TestBed.createComponent(ChurnMitigationOfferDialogComponent);
      fixture.detectChanges();
      return fixture;
    };

    const renderExisting = (offer: Partial<ChurnMitigationOfferResponseModel>) => {
      mockI18nService.t.mockImplementation((key: string, ...args: (string | number)[]) =>
        [key, ...args].join("|"),
      );
      buildComponent(offer, true);
      fixture = TestBed.createComponent(ChurnMitigationOfferDialogComponent);
      fixture.detectChanges();
      return fixture;
    };

    const text = () => fixture.nativeElement.textContent as string;

    describe("when the offer is a repeating fixed amount", () => {
      it("renders the recurring offer-body key with discount, interval, and duration args", () => {
        renderRecurringAmount(false);

        expect(text()).toContain("churnOfferDiscountBodyRecurringAmount|$15.00|month|year");
        expect(text()).not.toContain("churnOfferDiscountBody|");
      });

      it("renders the recurring success-body key after the offer is redeemed", () => {
        renderRecurringAmount(false);

        // Flip to the success state and re-render.
        (
          fixture.componentInstance as unknown as { offerRedeemed: { set: (v: boolean) => void } }
        ).offerRedeemed.set(true);
        fixture.detectChanges();

        expect(text()).toContain("churnOfferSuccessBodyRecurringAmount|$15.00|month|year");
        expect(text()).toContain("churnOfferDiscountSummaryRecurringAmount|$15.00/month|1|year");
        expect(text()).not.toContain("churnOfferSuccessBody|");
        expect(text()).not.toContain("churnOfferDiscountSummary|");
      });
    });

    describe("when the offer is not a repeating fixed amount", () => {
      it("renders the existing offer-body key for a repeating percentage", () => {
        renderExisting({
          percentOff: 15,
          amountOff: null,
          duration: "repeating",
          durationInMonths: 12,
          name: "15% Off",
        });

        expect(text()).toContain("churnOfferDiscountBody|15%|year");
        expect(text()).not.toContain("churnOfferDiscountBodyRecurringAmount");
      });

      it("renders the existing offer-body key for a one-time fixed amount", () => {
        renderExisting({
          percentOff: null,
          amountOff: 15,
          duration: "once",
          durationInMonths: null,
          name: "$15 Off",
        });

        expect(text()).toContain("churnOfferDiscountBody|$15.00|year");
        expect(text()).not.toContain("churnOfferDiscountBodyRecurringAmount");
      });

      it("renders the existing success and summary keys after redeeming a repeating percentage", () => {
        renderExisting({
          percentOff: 15,
          amountOff: null,
          duration: "repeating",
          durationInMonths: 12,
          name: "15% Off",
        });

        (
          fixture.componentInstance as unknown as { offerRedeemed: { set: (v: boolean) => void } }
        ).offerRedeemed.set(true);
        fixture.detectChanges();

        expect(text()).toContain("churnOfferSuccessBody|15%|year");
        expect(text()).toContain("churnOfferDiscountSummary|15%|1|year");
        expect(text()).not.toContain("churnOfferSuccessBodyRecurringAmount");
        expect(text()).not.toContain("churnOfferDiscountSummaryRecurringAmount");
      });
    });
  });
});
