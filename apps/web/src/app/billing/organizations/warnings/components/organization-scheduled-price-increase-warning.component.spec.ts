import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { OrganizationWarningsService } from "../services";
import { OrganizationScheduledPriceIncreaseWarning } from "../types";

import { OrganizationScheduledPriceIncreaseWarningComponent } from "./organization-scheduled-price-increase-warning.component";

describe("OrganizationScheduledPriceIncreaseWarningComponent", () => {
  let fixture: ComponentFixture<OrganizationScheduledPriceIncreaseWarningComponent>;
  let warningsService: MockProxy<OrganizationWarningsService>;
  let i18nService: MockProxy<I18nService>;

  const organization = { id: "org-id-123" } as Organization;

  const setWarning = (warning: OrganizationScheduledPriceIncreaseWarning | null) => {
    warningsService.getScheduledPriceIncreaseWarning$.mockReturnValue(of(warning));
  };

  beforeEach(async () => {
    warningsService = mock<OrganizationWarningsService>();
    i18nService = mock<I18nService>();

    i18nService.t.mockImplementation((key: string, ...args: any[]) => {
      switch (key) {
        case "scheduledPriceIncreaseWarningMonthly":
          return `Your subscription price will increase to ${args[0]} per seat per month on ${args[1]}. Your plan features and any existing discounts will stay exactly the same.`;
        case "scheduledPriceIncreaseWarningAnnually":
          return `Your subscription price will increase to ${args[0]} per seat per month (billed annually) on ${args[1]}. Your plan features and any existing discounts will stay exactly the same.`;
        case "priceIncreaseNotice":
          return "Price increase notice";
        default:
          return key;
      }
    });

    await TestBed.configureTestingModule({
      imports: [OrganizationScheduledPriceIncreaseWarningComponent],
      providers: [
        { provide: OrganizationWarningsService, useValue: warningsService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationScheduledPriceIncreaseWarningComponent);
    fixture.componentRef.setInput("organization", organization);
  });

  it("does not render a callout when there is no warning", () => {
    setWarning(null);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("bit-callout")).toBeNull();
  });

  it("renders the monthly message without the billed-annually fragment", () => {
    setWarning({
      seatPrice: 6,
      effectiveDate: new Date("2026-07-15T02:00:00Z"),
      cadence: "monthly",
    });

    fixture.detectChanges();

    expect(i18nService.t).toHaveBeenCalledWith(
      "scheduledPriceIncreaseWarningMonthly",
      "$6",
      "July 15, 2026",
    );
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("$6 per seat per month on July 15, 2026");
    expect(text).not.toContain("billed annually");
  });

  it("renders the annual message including the billed-annually fragment", () => {
    setWarning({
      seatPrice: 6,
      effectiveDate: new Date("2026-07-15T02:00:00Z"),
      cadence: "annually",
    });

    fixture.detectChanges();

    expect(i18nService.t).toHaveBeenCalledWith(
      "scheduledPriceIncreaseWarningAnnually",
      "$6",
      "July 15, 2026",
    );
    expect(fixture.nativeElement.textContent).toContain("(billed annually)");
  });

  it("shows cents only when the price has a fractional amount", () => {
    setWarning({
      seatPrice: 6.5,
      effectiveDate: new Date("2026-07-15T02:00:00Z"),
      cadence: "monthly",
    });

    fixture.detectChanges();

    expect(i18nService.t).toHaveBeenCalledWith(
      "scheduledPriceIncreaseWarningMonthly",
      "$6.50",
      "July 15, 2026",
    );
  });

  it("renders an info callout with no title", () => {
    setWarning({
      seatPrice: 6,
      effectiveDate: new Date("2026-07-15T02:00:00Z"),
      cadence: "monthly",
    });

    fixture.detectChanges();

    const callout = fixture.debugElement.query(By.css("bit-callout"));
    expect(callout.componentInstance.type()).toBe("info");
    expect(callout.componentInstance.title()).toBeNull();
  });
});
