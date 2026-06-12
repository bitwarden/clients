import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, ToastService } from "@bitwarden/components";

import { ChurnMitigationOfferResponseModel, OrganizationBillingClient } from "../clients";

import {
  ChurnMitigationOfferDialogComponent,
  ChurnMitigationOfferDialogParams,
} from "./churn-mitigation-offer-dialog.component";

describe("ChurnMitigationOfferDialogComponent", () => {
  let dialogRef: MockProxy<DialogRef>;
  let organizationBillingClient: MockProxy<OrganizationBillingClient>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;

  const buildComponent = (offer: ChurnMitigationOfferResponseModel) => {
    const params: ChurnMitigationOfferDialogParams = {
      organizationId: "org-id" as OrganizationId,
      offer,
      accessEndDate: null,
      planName: "Teams",
      nextChargeDate: null,
    };
    return new ChurnMitigationOfferDialogComponent(
      params,
      dialogRef,
      organizationBillingClient,
      toastService,
      i18nService,
      logService,
    );
  };

  beforeEach(() => {
    dialogRef = mock<DialogRef>();
    organizationBillingClient = mock<OrganizationBillingClient>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();
  });

  describe("discountLabel", () => {
    it("renders a percentage for percent-off coupons", () => {
      const offer = new ChurnMitigationOfferResponseModel({
        CouponId: "CHURN25",
        PercentOff: 25,
        Duration: "once",
        DurationInMonths: null,
        Name: "25% Off",
      });

      const component = buildComponent(offer);

      expect((component as any).discountLabel).toBe("25%");
    });

    it("renders a formatted currency amount for amount-off coupons", () => {
      const offer = new ChurnMitigationOfferResponseModel({
        CouponId: "CHURN-15-OFF",
        PercentOff: null,
        AmountOff: 1500,
        Currency: "usd",
        Duration: "once",
        DurationInMonths: null,
        Name: "$15 Off",
      });

      const component = buildComponent(offer);

      expect((component as any).discountLabel).toBe("$15 Off");
    });

    it("falls back to the coupon name when no discount values are present", () => {
      const offer = new ChurnMitigationOfferResponseModel({
        CouponId: "CHURN-FREE",
        PercentOff: null,
        AmountOff: null,
        Currency: null,
        Duration: "once",
        DurationInMonths: null,
        Name: "Special Offer",
      });

      const component = buildComponent(offer);

      expect((component as any).discountLabel).toBe("Special Offer");
    });
  });

  describe("duration", () => {
    beforeEach(() => {
      i18nService.t.mockImplementation((key) => key);
    });

    const build = (durationInMonths: number | null, duration = "repeating") =>
      buildComponent(
        new ChurnMitigationOfferResponseModel({
          CouponId: "CHURN",
          PercentOff: 15,
          Duration: duration,
          DurationInMonths: durationInMonths,
          Name: "Churn",
        }),
      );

    it("localizes a `once` coupon as a single year", () => {
      const component = build(null, "once") as any;

      expect(component.durationUnit).toBe("year");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("year");
    });

    it("localizes a 12-month coupon as a single year", () => {
      const component = build(12) as any;

      expect(component.durationUnit).toBe("year");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("year");
    });

    it("localizes a 24-month coupon as multiple years", () => {
      const component = build(24) as any;

      expect(component.durationUnit).toBe("years");
      expect(component.durationLength).toBe("2");
      expect(component.durationDescription).toBe("2 years");
    });

    it("localizes a 1-month coupon as a single month", () => {
      const component = build(1) as any;

      expect(component.durationUnit).toBe("month");
      expect(component.durationLength).toBe("1");
      expect(component.durationDescription).toBe("month");
    });

    it("localizes a multi-month coupon as plural months", () => {
      const component = build(3) as any;

      expect(component.durationUnit).toBe("months");
      expect(component.durationLength).toBe("3");
      expect(component.durationDescription).toBe("3 months");
    });
  });
});
