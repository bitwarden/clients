import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums/product-tier-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../shared";
import { AnnualUpgradeOfferResponseModel, OrganizationBillingClient } from "../clients";

import {
  OffboardingSurveyComponent,
  OffboardingSurveyDialogResultType,
} from "./offboarding-survey.component";

describe("OffboardingSurveyComponent", () => {
  beforeAll(() => {
    // jsdom does not implement IntersectionObserver; the bit-dialog wrapper this component
    // renders into uses it internally (see libs/components/src/utils/dom-observables.ts).
    global.IntersectionObserver = class {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as any;
  });

  const mockDialogRef = mock<DialogRef>();
  const mockBillingApiService = mock<BillingApiServiceAbstraction>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();
  const mockToastService = mock<ToastService>();
  const mockI18nService = mock<I18nService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockLogService = mock<LogService>();

  let fixture: ComponentFixture<OffboardingSurveyComponent>;

  const build = async (offer: AnnualUpgradeOfferResponseModel | null, loadError?: unknown) => {
    if (loadError !== undefined) {
      mockOrganizationBillingClient.getAnnualUpgradeOffer.mockRejectedValue(loadError);
    } else {
      mockOrganizationBillingClient.getAnnualUpgradeOffer.mockResolvedValue(offer);
    }
    // Echo the i18n key so assertions can check for a (design-pending) translated string without
    // depending on real copy. Mirrors the convention in organization-subscription-cloud.component.spec.ts.
    mockI18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [SharedModule, ReactiveFormsModule],
      declarations: [OffboardingSurveyComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: "Organization",
            id: "org-1",
            plan: 17, // PlanType.TeamsMonthly
            productTier: ProductTierType.Teams,
          },
        },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: BillingApiServiceAbstraction, useValue: mockBillingApiService },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OffboardingSurveyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("fetches the annual upgrade offer on init for a business org", async () => {
    await build(null);

    expect(mockOrganizationBillingClient.getAnnualUpgradeOffer).toHaveBeenCalledWith("org-1");
  });

  it("swallows and logs a failure to load the offer, leaving the survey usable", async () => {
    const error = new Error("offer load failed");

    await build(null, error);

    expect(mockLogService.error).toHaveBeenCalledWith(error);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]')).toBeNull();
  });

  it("does not render the callout when no offer is available", async () => {
    await build(null);
    fixture.componentInstance.formGroup.controls.reason.setValue("too_expensive");
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]')).toBeNull();
  });

  it("renders the callout only when the cost reason is selected", async () => {
    const offer = new AnnualUpgradeOfferResponseModel({
      CurrentAnnualCost: 60,
      NewAnnualCost: 48,
      Savings: 12,
    });
    await build(offer);

    expect(fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]')).toBeNull();

    fixture.componentInstance.formGroup.controls.reason.setValue("too_expensive");
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="annual-upgrade-offer"]'),
    ).not.toBeNull();
  });

  it("redeeming the offer closes the dialog with a success toast and does not cancel", async () => {
    const offer = new AnnualUpgradeOfferResponseModel({
      CurrentAnnualCost: 60,
      NewAnnualCost: 48,
      Savings: 12,
    });
    await build(offer);
    mockOrganizationBillingClient.redeemAnnualUpgradeOffer.mockResolvedValue(undefined);

    await fixture.componentInstance.switchToAnnualBilling();

    expect(mockOrganizationBillingClient.redeemAnnualUpgradeOffer).toHaveBeenCalledWith("org-1");
    expect(mockBillingApiService.cancelOrganizationSubscription).not.toHaveBeenCalled();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(OffboardingSurveyDialogResultType.Submitted);
  });

  it("a failed redeem shows an inline error and keeps the dialog open", async () => {
    const offer = new AnnualUpgradeOfferResponseModel({
      CurrentAnnualCost: 60,
      NewAnnualCost: 48,
      Savings: 12,
    });
    await build(offer);
    mockOrganizationBillingClient.redeemAnnualUpgradeOffer.mockRejectedValue(new Error("boom"));

    await fixture.componentInstance.switchToAnnualBilling();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.annualUpgradeRedeemLoading).toBe(false);
    expect(fixture.componentInstance.annualUpgradeRedeemError).toBeTruthy();
  });
});
