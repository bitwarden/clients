import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../organizations/change-plan-dialog.component";

import { BillingConstraintService, SeatLimitResult } from "./billing-constraint.service";

jest.mock("../../organizations/change-plan-dialog.component");

describe("BillingConstraintService", () => {
  let service: BillingConstraintService;
  let i18nService: jest.Mocked<I18nService>;
  let dialogService: jest.Mocked<DialogService>;
  let toastService: jest.Mocked<ToastService>;
  let router: jest.Mocked<Router>;
  let organizationMetadataService: jest.Mocked<OrganizationMetadataServiceAbstraction>;

  const mockOrganizationId = "org-123" as OrganizationId;

  const createMockOrganization = (overrides: Partial<Organization> = {}): Organization => {
    const org = new Organization();
    org.id = mockOrganizationId;
    org.seats = 10;
    org.productTierType = ProductTierType.Teams;

    Object.defineProperty(org, "hasReseller", {
      value: false,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(org, "canEditSubscription", {
      value: true,
      writable: true,
      configurable: true,
    });

    return Object.assign(org, overrides);
  };

  const createMockBillingMetadata = (
    overrides: Partial<OrganizationBillingMetadataResponse> = {},
  ): OrganizationBillingMetadataResponse => {
    return {
      organizationOccupiedSeats: 5,
      ...overrides,
    } as OrganizationBillingMetadataResponse;
  };

  beforeEach(() => {
    const mockDialogRef = {
      closed: of(true),
    };

    const mockSimpleDialogRef = {
      closed: of(true),
    };

    i18nService = {
      t: jest.fn().mockReturnValue("translated-text"),
    } as any;

    dialogService = {
      openSimpleDialogRef: jest.fn().mockReturnValue(mockSimpleDialogRef),
    } as any;

    toastService = {
      showToast: jest.fn(),
    } as any;

    router = {
      navigate: jest.fn().mockResolvedValue(true),
    } as any;

    organizationMetadataService = {
      getOrganizationMetadata$: jest.fn(),
      refreshMetadataCache: jest.fn(),
    } as any;

    (openChangePlanDialog as jest.Mock).mockReturnValue(mockDialogRef);

    TestBed.configureTestingModule({
      providers: [
        BillingConstraintService,
        { provide: I18nService, useValue: i18nService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
      ],
    });

    service = TestBed.inject(BillingConstraintService);
  });

  describe("checkSeatLimit", () => {
    it("should allow users when occupied seats are less than total seats", () => {
      const organization = createMockOrganization({ seats: 10 });
      const billingMetadata = createMockBillingMetadata({ organizationOccupiedSeats: 5 });

      const result = service.checkSeatLimit(organization, billingMetadata);

      expect(result).toEqual({ canAddUsers: true });
    });

    it("should allow users when occupied seats equal total seats for non-fixed seat plans", () => {
      const organization = createMockOrganization({
        seats: 10,
        productTierType: ProductTierType.Teams,
      });
      const billingMetadata = createMockBillingMetadata({ organizationOccupiedSeats: 10 });

      const result = service.checkSeatLimit(organization, billingMetadata);

      expect(result).toEqual({ canAddUsers: true });
    });

    it("should block users with reseller-limit reason when organization has reseller", () => {
      const organization = createMockOrganization({
        seats: 10,
        hasReseller: true,
      });
      const billingMetadata = createMockBillingMetadata({ organizationOccupiedSeats: 10 });

      const result = service.checkSeatLimit(organization, billingMetadata);

      expect(result).toEqual({
        canAddUsers: false,
        reason: "reseller-limit",
      });
    });

    it("should block users with fixed-seat-limit reason for fixed seat plans", () => {
      const organization = createMockOrganization({
        seats: 10,
        productTierType: ProductTierType.Free,
        canEditSubscription: true,
      });
      const billingMetadata = createMockBillingMetadata({ organizationOccupiedSeats: 10 });

      const result = service.checkSeatLimit(organization, billingMetadata);

      expect(result).toEqual({
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: true,
      });
    });

    it("should not show upgrade dialog when organization cannot edit subscription", () => {
      const organization = createMockOrganization({
        seats: 10,
        productTierType: ProductTierType.TeamsStarter,
        canEditSubscription: false,
      });
      const billingMetadata = createMockBillingMetadata({ organizationOccupiedSeats: 10 });

      const result = service.checkSeatLimit(organization, billingMetadata);

      expect(result).toEqual({
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: false,
      });
    });

    it("shoud throw if missing billingMetadata", () => {
      const organization = createMockOrganization({ seats: 10 });
      const billingMetadata = createMockBillingMetadata({
        organizationOccupiedSeats: undefined as any,
      });

      const err = () => service.checkSeatLimit(organization, billingMetadata);

      expect(err).toThrow("Cannot check seat limit: billingMetadata is null or undefined.");
    });
  });

  describe("seatLimitReached", () => {
    it("should return false when canAddUsers is true", async () => {
      const result: SeatLimitResult = { canAddUsers: true };
      const organization = createMockOrganization();

      const seatLimitReached = await service.seatLimitReached(result, organization);

      expect(seatLimitReached).toBe(false);
    });

    it("should show toast and return true for reseller-limit", async () => {
      const result: SeatLimitResult = { canAddUsers: false, reason: "reseller-limit" };
      const organization = createMockOrganization();

      const seatLimitReached = await service.seatLimitReached(result, organization);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "translated-text",
        message: "translated-text",
      });
      expect(i18nService.t).toHaveBeenCalledWith("seatLimitReached");
      expect(i18nService.t).toHaveBeenCalledWith("contactYourProvider");
      expect(seatLimitReached).toBe(true);
    });

    it("should return true when upgrade dialog is cancelled", async () => {
      const result: SeatLimitResult = {
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: true,
      };
      const organization = createMockOrganization();
      const mockDialogRef = { closed: of(ChangePlanDialogResultType.Closed) };
      (openChangePlanDialog as jest.Mock).mockReturnValue(mockDialogRef);

      const seatLimitReached = await service.seatLimitReached(result, organization);

      expect(openChangePlanDialog).toHaveBeenCalledWith(dialogService, {
        data: {
          organizationId: organization.id,
          productTierType: organization.productTierType,
        },
      });
      expect(seatLimitReached).toBe(true);
    });

    it("should return false when upgrade dialog is submitted", async () => {
      const result: SeatLimitResult = {
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: true,
      };
      const organization = createMockOrganization();
      const mockDialogRef = { closed: of(ChangePlanDialogResultType.Submitted) };
      (openChangePlanDialog as jest.Mock).mockReturnValue(mockDialogRef);

      const seatLimitReached = await service.seatLimitReached(result, organization);

      expect(seatLimitReached).toBe(false);
    });

    it("should show seat limit dialog when shouldShowUpgradeDialog is false", async () => {
      const result: SeatLimitResult = {
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: false,
      };
      const organization = createMockOrganization({
        canEditSubscription: false,
        productTierType: ProductTierType.Free,
      });

      const seatLimitReached = await service.seatLimitReached(result, organization);

      expect(dialogService.openSimpleDialogRef).toHaveBeenCalled();
      expect(seatLimitReached).toBe(true);
    });

    it("should return true for unknown reasons", async () => {
      const result: SeatLimitResult = { canAddUsers: false };
      const organization = createMockOrganization();

      const seatLimitReached = await service.seatLimitReached(result, organization);

      expect(seatLimitReached).toBe(true);
    });
  });

  describe("navigateToPaymentMethod", () => {
    it("should navigate to payment method with correct parameters", async () => {
      const organization = createMockOrganization();

      await service.navigateToPaymentMethod(organization);

      expect(router.navigate).toHaveBeenCalledWith(
        ["organizations", organization.id, "billing", "payment-method"],
        {
          state: { launchPaymentModalAutomatically: true },
        },
      );
    });
  });

  describe("private methods through public method coverage", () => {
    describe("getDialogContent via showSeatLimitReachedDialog", () => {
      it("should get correct dialog content for Free organization", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          productTierType: ProductTierType.Free,
          canEditSubscription: false,
          seats: 5,
        });

        await service.seatLimitReached(result, organization);

        expect(i18nService.t).toHaveBeenCalledWith("freeOrgInvLimitReachedNoManageBilling", 5);
      });

      it("should get correct dialog content for TeamsStarter organization", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          productTierType: ProductTierType.TeamsStarter,
          canEditSubscription: false,
          seats: 3,
        });

        await service.seatLimitReached(result, organization);

        expect(i18nService.t).toHaveBeenCalledWith(
          "teamsStarterPlanInvLimitReachedNoManageBilling",
          3,
        );
      });

      it("should get correct dialog content for Families organization", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          productTierType: ProductTierType.Families,
          canEditSubscription: false,
          seats: 6,
        });

        await service.seatLimitReached(result, organization);

        expect(i18nService.t).toHaveBeenCalledWith("familiesPlanInvLimitReachedNoManageBilling", 6);
      });

      it("should throw error for unsupported product type in getProductKey", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          productTierType: ProductTierType.Enterprise,
          canEditSubscription: false,
        });

        await expect(service.seatLimitReached(result, organization)).rejects.toThrow(
          `Unsupported product type: ${ProductTierType.Enterprise}`,
        );
      });
    });

    describe("getAcceptButtonText via showSeatLimitReachedDialog", () => {
      it("should return 'ok' when organization cannot edit subscription", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          canEditSubscription: false,
          productTierType: ProductTierType.Free,
        });

        await service.seatLimitReached(result, organization);

        expect(i18nService.t).toHaveBeenCalledWith("ok");
      });

      it("should return 'upgrade' when organization can edit subscription", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          canEditSubscription: true,
          productTierType: ProductTierType.Free,
        });
        const mockSimpleDialogRef = { closed: of(false) };
        dialogService.openSimpleDialogRef.mockReturnValue(mockSimpleDialogRef);

        await service.seatLimitReached(result, organization);

        expect(i18nService.t).toHaveBeenCalledWith("upgrade");
      });

      it("should throw error for unsupported product type in getAcceptButtonText", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          canEditSubscription: true,
          productTierType: ProductTierType.Enterprise,
        });

        await expect(service.seatLimitReached(result, organization)).rejects.toThrow(
          `Unsupported product type: ${ProductTierType.Enterprise}`,
        );
      });
    });

    describe("handleUpgradeNavigation", () => {
      it("should navigate to billing subscription with upgrade query param", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          canEditSubscription: true,
          productTierType: ProductTierType.Free,
        });
        const mockSimpleDialogRef = { closed: of(true) };
        dialogService.openSimpleDialogRef.mockReturnValue(mockSimpleDialogRef);

        await service.seatLimitReached(result, organization);

        expect(router.navigate).toHaveBeenCalledWith(
          ["/organizations", organization.id, "billing", "subscription"],
          { queryParams: { upgrade: true } },
        );
      });

      it("should throw error for non-self-upgradable product type", async () => {
        const result: SeatLimitResult = {
          canAddUsers: false,
          reason: "fixed-seat-limit",
          shouldShowUpgradeDialog: false,
        };
        const organization = createMockOrganization({
          canEditSubscription: true,
          productTierType: ProductTierType.Enterprise,
        });
        const mockSimpleDialogRef = { closed: of(true) };
        dialogService.openSimpleDialogRef.mockReturnValue(mockSimpleDialogRef);

        await expect(service.seatLimitReached(result, organization)).rejects.toThrow(
          `Unsupported product type: ${ProductTierType.Enterprise}`,
        );
      });
    });
  });
});
