import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { OrganizationWarningsService } from "../services";
import { OrganizationFreeTrialWarning } from "../types";

import { OrganizationFreeTrialWarningComponent } from "./organization-free-trial-warning.component";

describe("OrganizationFreeTrialWarningComponent", () => {
  let fixture: ComponentFixture<OrganizationFreeTrialWarningComponent>;
  let warningsService: MockProxy<OrganizationWarningsService>;
  let i18nService: MockProxy<I18nService>;

  const organization = { id: "org-id-123", name: "Test Organization" } as Organization;

  const salesAssistedText = "Contact your Bitwarden sales representative to set up billing.";
  const addPaymentMethodText = "Click here to add a payment method.";

  const setWarning = (warning: OrganizationFreeTrialWarning | null) => {
    warningsService.getFreeTrialWarning$.mockReturnValue(of(warning));
  };

  const warningFor = (isSalesAssisted: boolean): OrganizationFreeTrialWarning => ({
    organization,
    message: "Your free trial ends in 5 days.",
    isSalesAssisted,
  });

  beforeEach(async () => {
    warningsService = mock<OrganizationWarningsService>();
    i18nService = mock<I18nService>();

    i18nService.t.mockImplementation((key: string) => {
      switch (key) {
        case "freeTrialSalesAssistedContactRep":
          return salesAssistedText;
        case "clickHereToAddPaymentMethod":
          return addPaymentMethodText;
        default:
          return key;
      }
    });

    await TestBed.configureTestingModule({
      imports: [OrganizationFreeTrialWarningComponent],
      providers: [
        provideRouter([]),
        { provide: OrganizationWarningsService, useValue: warningsService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationFreeTrialWarningComponent);
    fixture.componentInstance.organization = organization;
  });

  it("does not render a banner when there is no warning", () => {
    setWarning(null);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("#free-trial-banner")).toBeNull();
  });

  it("renders the countdown message", () => {
    setWarning(warningFor(false));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Your free trial ends in 5 days.");
  });

  describe("when the trial is not sales-assisted", () => {
    beforeEach(() => {
      setWarning(warningFor(false));
      fixture.detectChanges();
    });

    it("renders the add-payment-method link", () => {
      const link = fixture.debugElement.query(By.css("a[bitLink]"));

      expect(link).not.toBeNull();
      expect(link.nativeElement.textContent.trim()).toBe(addPaymentMethodText);
    });

    it("does not render the sales representative message", () => {
      expect(fixture.nativeElement.textContent).not.toContain(salesAssistedText);
    });

    it("emits clicked when the link is clicked", () => {
      const clicked = jest.fn();
      fixture.componentInstance.clicked.subscribe(clicked);

      fixture.debugElement.query(By.css("a[bitLink]")).nativeElement.click();

      expect(clicked).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the trial is sales-assisted", () => {
    beforeEach(() => {
      setWarning(warningFor(true));
      fixture.detectChanges();
    });

    it("renders the sales representative message", () => {
      expect(fixture.nativeElement.textContent).toContain(salesAssistedText);
    });

    it("does not render the add-payment-method link", () => {
      expect(fixture.debugElement.query(By.css("a[bitLink]"))).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain(addPaymentMethodText);
    });

    it("keeps the countdown message when the link is replaced", () => {
      expect(fixture.nativeElement.textContent).toContain("Your free trial ends in 5 days.");
    });
  });

  it("requests the warning with the organization-name flag when enabled", () => {
    fixture.componentInstance.includeOrganizationNameInMessaging = true;
    setWarning(warningFor(true));

    fixture.detectChanges();

    expect(warningsService.getFreeTrialWarning$).toHaveBeenCalledWith(organization, true);
  });
});
