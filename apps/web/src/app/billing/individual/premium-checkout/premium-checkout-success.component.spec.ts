import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { PremiumCheckoutSuccessComponent } from "./premium-checkout-success.component";

describe("PremiumCheckoutSuccessComponent", () => {
  let fixture: ComponentFixture<PremiumCheckoutSuccessComponent>;
  let i18nService: MockProxy<I18nService>;

  const FIXED_NOW = new Date("2026-05-15T12:00:00Z");

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);

    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [PremiumCheckoutSuccessComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PremiumCheckoutSuccessComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the heading", () => {
    expect(fixture.nativeElement.querySelector("h1")?.textContent).toContain("paymentSuccessful");
  });

  it("renders the processing-message body copy", () => {
    expect(fixture.nativeElement.querySelector("p")?.textContent).toContain(
      "paymentSuccessfulProcessingMessage",
    );
  });

  it("renders the detail card labels in order", () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll("dl dt")).map((dt: Element) =>
      (dt as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(["planPurchased", "startDate", "renewalDate"]);
  });

  it("renders Premium as the plan value", () => {
    const firstValue = fixture.nativeElement.querySelector("dl dd")?.textContent?.trim();
    expect(firstValue).toBe("premium");
  });

  it("renders today and today + 1 year for the dates", () => {
    const values = Array.from(fixture.nativeElement.querySelectorAll("dl dd")).map((dd: Element) =>
      (dd as HTMLElement).textContent?.trim(),
    );
    expect(values[1]).toBe("May 15, 2026");
    expect(values[2]).toBe("May 15, 2027");
  });

  it("does not render a spinner, manage-plan button, or status badge", () => {
    expect(fixture.nativeElement.querySelector("bit-icon[name='bwi-spinner']")).toBeNull();
    expect(fixture.nativeElement.querySelector("[data-testid='manage-plan-button']")).toBeNull();
    expect(fixture.nativeElement.querySelector("[data-testid='upgrade-status-badge']")).toBeNull();
  });
});
