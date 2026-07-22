import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { SponsoringOrgRowComponent } from "./sponsoring-org-row.component";

const familiesTier: PersonalSubscriptionPricingTier = {
  id: PersonalSubscriptionPricingTierIds.Families,
  name: "Families",
  description: "",
  availableCadences: ["annually"],
  passwordManager: { type: "packaged", annualPrice: 40, users: 6, features: [] },
};

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-id",
    name: "Test Org",
    familySponsorshipFriendlyName: "friend@example.com",
    familySponsorshipToDelete: false,
    familySponsorshipValidUntil: null,
    familySponsorshipLastSyncDate: null,
    ...overrides,
  } as Organization;
}

describe("SponsoringOrgRowComponent", () => {
  let component: SponsoringOrgRowComponent;
  let fixture: ComponentFixture<SponsoringOrgRowComponent>;

  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();
  const mockPolicyService = mock<PolicyService>();
  const mockAccountService = mock<AccountService>();
  const mockSponsorshipApiService = mock<OrganizationSponsorshipApiServiceAbstraction>();
  const mockPricingService = mock<SubscriptionPricingServiceAbstraction>();

  beforeEach(async () => {
    jest.resetAllMocks();

    mockI18nService.t.mockImplementation((key: string) => key);
    mockI18nService.locale$ = of("en-US") as any;
    mockAccountService.activeAccount$ = of({ id: "user-id" } as any);
    mockPolicyService.policiesByType$.mockReturnValue(of([]));
    mockPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(of([familiesTier]));
    mockDialogService.openSimpleDialog.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [SponsoringOrgRowComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: AccountService, useValue: mockAccountService },
        {
          provide: OrganizationSponsorshipApiServiceAbstraction,
          useValue: mockSponsorshipApiService,
        },
        { provide: SubscriptionPricingServiceAbstraction, useValue: mockPricingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SponsoringOrgRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("sponsoringOrg", makeOrg());
  });

  describe("revokeSponsorship", () => {
    describe("with an accepted sponsorship", () => {
      beforeEach(async () => {
        fixture.componentRef.setInput(
          "sponsoringOrg",
          makeOrg({ familySponsorshipValidUntil: new Date("2025-12-10") }),
        );
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it("passes the formatted annual price to the confirmation dialog", async () => {
        await (component as any).revokeSponsorship();

        expect(mockI18nService.t).toHaveBeenCalledWith(
          "revokeSponsorshipAcceptedWithPriceConfirmation",
          "friend@example.com",
          "$40",
          expect.any(String),
        );
      });

      it("formats a decimal annual price with two decimal places", async () => {
        mockPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
          of([
            {
              ...familiesTier,
              passwordManager: { ...familiesTier.passwordManager, annualPrice: 40.5 },
            } as PersonalSubscriptionPricingTier,
          ]),
        );

        await (component as any).revokeSponsorship();

        expect(mockI18nService.t).toHaveBeenCalledWith(
          "revokeSponsorshipAcceptedWithPriceConfirmation",
          expect.any(String),
          "$40.50",
          expect.any(String),
        );
      });

      it("falls back to $0 when the families tier is not in the pricing response", async () => {
        mockPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(of([]));

        await (component as any).revokeSponsorship();

        expect(mockI18nService.t).toHaveBeenCalledWith(
          "revokeSponsorshipAcceptedWithPriceConfirmation",
          expect.any(String),
          "$0",
          expect.any(String),
        );
      });

      it("revokes the sponsorship, shows a success toast, and emits sponsorshipRemoved on confirm", async () => {
        mockDialogService.openSimpleDialog.mockResolvedValue(true);
        let emitted = false;
        component.sponsorshipRemoved.subscribe(() => (emitted = true));

        await (component as any).revokeSponsorship();

        expect(mockSponsorshipApiService.deleteRevokeSponsorship).toHaveBeenCalledWith("org-id");
        expect(mockToastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ message: "reclaimedFreePlan" }),
        );
        expect(emitted).toBe(true);
      });

      it("does nothing on cancel", async () => {
        let emitted = false;
        component.sponsorshipRemoved.subscribe(() => (emitted = true));

        await (component as any).revokeSponsorship();

        expect(mockSponsorshipApiService.deleteRevokeSponsorship).not.toHaveBeenCalled();
        expect(mockToastService.showToast).not.toHaveBeenCalled();
        expect(emitted).toBe(false);
      });
    });

    describe("with a sent (unaccepted) sponsorship", () => {
      beforeEach(async () => {
        fixture.componentRef.setInput(
          "sponsoringOrg",
          makeOrg({ familySponsorshipValidUntil: null }),
        );
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it("uses the sent-sponsorship confirmation key", async () => {
        await (component as any).revokeSponsorship();

        expect(mockI18nService.t).toHaveBeenCalledWith(
          "updatedRevokeSponsorshipConfirmationForSentSponsorship",
          "friend@example.com",
        );
      });
    });
  });

  describe("resendEmail", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("sends the resend offer and shows a success toast", async () => {
      await (component as any).resendEmail();

      expect(mockSponsorshipApiService.postResendSponsorshipOffer).toHaveBeenCalledWith(
        "org-id",
        "friend@example.com",
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "emailSent" }),
      );
    });
  });

  describe("setStatus", () => {
    it("shows revokeWhenExpired and danger class when pending deletion with an active sponsorship", async () => {
      fixture.componentRef.setInput(
        "sponsoringOrg",
        makeOrg({
          familySponsorshipToDelete: true,
          familySponsorshipValidUntil: new Date("2025-12-10"),
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).statusMessage()).toBe("revokeWhenExpired");
      expect((component as any).statusClass()).toBe("tw-text-danger");
    });

    it("shows requestRemoved and danger class when pending deletion without a valid-until date", async () => {
      fixture.componentRef.setInput(
        "sponsoringOrg",
        makeOrg({ familySponsorshipToDelete: true, familySponsorshipValidUntil: null }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).statusMessage()).toBe("requestRemoved");
      expect((component as any).statusClass()).toBe("tw-text-danger");
    });

    it("shows active and success class when sponsoring and not pending deletion", async () => {
      fixture.componentRef.setInput(
        "sponsoringOrg",
        makeOrg({
          familySponsorshipToDelete: false,
          familySponsorshipValidUntil: new Date("2025-12-10"),
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).statusMessage()).toBe("active");
      expect((component as any).statusClass()).toBe("tw-text-success");
    });

    it("shows sent and success class on cloud when sponsorship has not been accepted", async () => {
      fixture.componentRef.setInput("isSelfHosted", false);
      fixture.componentRef.setInput(
        "sponsoringOrg",
        makeOrg({ familySponsorshipToDelete: false, familySponsorshipValidUntil: null }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).statusMessage()).toBe("sent");
      expect((component as any).statusClass()).toBe("tw-text-success");
    });

    it("shows sent and success class on self-hosted when synced", async () => {
      fixture.componentRef.setInput("isSelfHosted", true);
      fixture.componentRef.setInput(
        "sponsoringOrg",
        makeOrg({
          familySponsorshipToDelete: false,
          familySponsorshipValidUntil: null,
          familySponsorshipLastSyncDate: new Date("2025-01-01"),
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).statusMessage()).toBe("sent");
      expect((component as any).statusClass()).toBe("tw-text-success");
    });

    it("shows requested and success class on self-hosted before first sync", async () => {
      fixture.componentRef.setInput("isSelfHosted", true);
      fixture.componentRef.setInput(
        "sponsoringOrg",
        makeOrg({
          familySponsorshipToDelete: false,
          familySponsorshipValidUntil: null,
          familySponsorshipLastSyncDate: null,
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).statusMessage()).toBe("requested");
      expect((component as any).statusClass()).toBe("tw-text-success");
    });
  });
});
