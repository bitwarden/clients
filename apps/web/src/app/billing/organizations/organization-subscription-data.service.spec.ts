import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationApiKeyType,
  OrganizationUserType,
  ProviderType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";
import { SubscriptionPreview } from "@bitwarden/subscription";

import { SubscriptionPreviewService } from "../services/subscription-preview.service";

import { OrganizationSubscriptionDataService } from "./organization-subscription-data.service";

describe("OrganizationSubscriptionDataService", () => {
  let service: OrganizationSubscriptionDataService;
  let orgService: jest.Mocked<OrganizationService>;
  let orgApiService: jest.Mocked<OrganizationApiServiceAbstraction>;
  let orgUserApiService: jest.Mocked<OrganizationUserApiService>;
  let previewService: jest.Mocked<SubscriptionPreviewService>;
  let accountService: jest.Mocked<AccountService>;

  beforeEach(() => {
    const activeAccountSubject = new BehaviorSubject<any>({ profile: { id: "user-123" } });

    const accountServiceMock = mock<AccountService>();
    Object.defineProperty(accountServiceMock, "activeAccount$", {
      value: activeAccountSubject.asObservable(),
      configurable: true,
    });

    accountService = accountServiceMock as jest.Mocked<AccountService>;
    orgService = mock<OrganizationService>();
    orgApiService = mock<OrganizationApiServiceAbstraction>();
    orgUserApiService = mock<OrganizationUserApiService>();
    previewService = mock<SubscriptionPreviewService>();

    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionDataService,
        { provide: OrganizationService, useValue: orgService },
        { provide: OrganizationApiServiceAbstraction, useValue: orgApiService },
        { provide: OrganizationUserApiService, useValue: orgUserApiService },
        { provide: SubscriptionPreviewService, useValue: previewService },
        { provide: AccountService, useValue: accountService },
      ],
    });

    service = TestBed.inject(OrganizationSubscriptionDataService);
  });

  describe("organization$", () => {
    it("should return organization matching organizationId", (done) => {
      const mockOrg: Organization = { id: "org-123", name: "Test Org" } as Organization;
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );

      service.organization$("org-123").subscribe((org) => {
        expect(org).toEqual(mockOrg);
        done();
      });
    });

    it("should return undefined when organization not found", (done) => {
      const mockOrg: Organization = { id: "org-456" } as Organization;
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );

      service.organization$("org-123").subscribe((org) => {
        expect(org).toBeUndefined();
        done();
      });
    });
  });

  describe("organizationSubscription$", () => {
    it("should fetch subscription for organization", (done) => {
      const mockOrg = createOrganization({ isOwner: true });
      const mockSubscription: OrganizationSubscriptionResponse = {
        id: "sub-123",
        plan: {},
      } as OrganizationSubscriptionResponse;

      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );
      orgApiService.getSubscription.mockResolvedValue(mockSubscription);

      service.organizationSubscription$("org-123").subscribe((sub) => {
        expect(sub).toEqual(mockSubscription);
        expect(orgApiService.getSubscription).toHaveBeenCalledWith("org-123");
        done();
      });
    });

    it("should return null when organization not found", (done) => {
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([]).asObservable(),
      );

      service.organizationSubscription$("org-123").subscribe((sub) => {
        expect(sub).toBeNull();
        done();
      });
    });

    it("does not re-fetch when organizations$ re-emits an unchanged org", () => {
      const orgs$ = new BehaviorSubject<Organization[]>([createOrganization({ isOwner: true })]);
      orgService.organizations$.mockImplementation((_userId: any) => orgs$.asObservable());
      orgApiService.getSubscription.mockResolvedValue({
        id: "sub-123",
      } as OrganizationSubscriptionResponse);

      const subscription = service.organizationSubscription$("org-123").subscribe();
      orgs$.next([createOrganization({ isOwner: true })]);

      expect(orgApiService.getSubscription).toHaveBeenCalledTimes(1);
      subscription.unsubscribe();
    });

    it("does not fetch the subscription for a provider-managed organization", (done) => {
      const mockOrg = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
      });
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );

      service.organizationSubscription$("org-123").subscribe((sub) => {
        expect(sub).toBeNull();
        expect(orgApiService.getSubscription).not.toHaveBeenCalled();
        done();
      });
    });

    it("does not fetch the subscription when the user cannot view it", (done) => {
      const mockOrg = createOrganization({ type: OrganizationUserType.User });
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );

      service.organizationSubscription$("org-123").subscribe((sub) => {
        expect(sub).toBeNull();
        expect(orgApiService.getSubscription).not.toHaveBeenCalled();
        done();
      });
    });

    it("fetches the subscription for a resold organization owner", (done) => {
      const mockOrg = createOrganization({ isOwner: true, hasReseller: true });
      const mockSubscription: OrganizationSubscriptionResponse = {
        id: "sub-123",
        plan: {},
      } as OrganizationSubscriptionResponse;

      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );
      orgApiService.getSubscription.mockResolvedValue(mockSubscription);

      service.organizationSubscription$("org-123").subscribe((sub) => {
        expect(sub).toEqual(mockSubscription);
        expect(orgApiService.getSubscription).toHaveBeenCalledWith("org-123");
        done();
      });
    });
  });

  describe("hasBillingSyncToken$", () => {
    it("should return true when BillingSync API key exists", (done) => {
      const mockOrg: Organization = { id: "org-123" } as Organization;
      const mockApiKeys = {
        data: [
          { id: "key-1", keyType: OrganizationApiKeyType.BillingSync },
          { id: "key-2", keyType: OrganizationApiKeyType.OrganizationManageSso },
        ],
      };

      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );
      orgApiService.getApiKeyInformation.mockResolvedValue(mockApiKeys as any);

      service.hasBillingSyncToken$("org-123").subscribe((hasToken) => {
        expect(hasToken).toBe(true);
        expect(orgApiService.getApiKeyInformation).toHaveBeenCalledWith("org-123");
        done();
      });
    });

    it("should return false when no BillingSync API key", (done) => {
      const mockOrg: Organization = { id: "org-123" } as Organization;
      const mockApiKeys = {
        data: [{ id: "key-1", keyType: OrganizationApiKeyType.OrganizationManageSso }],
      };

      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );
      orgApiService.getApiKeyInformation.mockResolvedValue(mockApiKeys as any);

      service.hasBillingSyncToken$("org-123").subscribe((hasToken) => {
        expect(hasToken).toBe(false);
        done();
      });
    });

    it("should return false when organization not found", (done) => {
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([]).asObservable(),
      );

      service.hasBillingSyncToken$("org-123").subscribe((hasToken) => {
        expect(hasToken).toBe(false);
        expect(orgApiService.getApiKeyInformation).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe("resellerSeatsRemaining$", () => {
    it("should calculate remaining seats for reseller org", (done) => {
      const mockOrg: Organization = { id: "org-123", hasReseller: true, seats: 50 } as Organization;
      const mockUsers = {
        data: [
          { id: "user-1", status: OrganizationUserStatusType.Confirmed },
          { id: "user-2", status: OrganizationUserStatusType.Accepted },
          { id: "user-3", status: OrganizationUserStatusType.Invited },
          { id: "user-4", status: "revoked" as any },
        ],
      };

      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );
      orgUserApiService.getAllUsers.mockResolvedValue(mockUsers as any);

      service.resellerSeatsRemaining$("org-123").subscribe((remaining) => {
        expect(remaining).toBe(47); // 50 - 3 active users
        expect(orgUserApiService.getAllUsers).toHaveBeenCalledWith("org-123");
        done();
      });
    });

    it("should return null when organization is not a reseller", (done) => {
      const mockOrg: Organization = { id: "org-123", hasReseller: false } as Organization;
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([mockOrg]).asObservable(),
      );

      service.resellerSeatsRemaining$("org-123").subscribe((remaining) => {
        expect(remaining).toBeNull();
        expect(orgUserApiService.getAllUsers).not.toHaveBeenCalled();
        done();
      });
    });

    it("should return null when organization not found", (done) => {
      orgService.organizations$.mockImplementation((_userId: any) =>
        new BehaviorSubject([]).asObservable(),
      );

      service.resellerSeatsRemaining$("org-123").subscribe((remaining) => {
        expect(remaining).toBeNull();
        expect(orgUserApiService.getAllUsers).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe("getSubscriptionPreview", () => {
    it("should call SubscriptionPreviewService with organization id", async () => {
      const mockPreview: SubscriptionPreview = {
        status: "active",
        cart: {},
      } as SubscriptionPreview;

      previewService.getOrganizationSubscriptionPreview.mockResolvedValue(mockPreview);

      const result = await service.getSubscriptionPreview("org-123");

      expect(result).toEqual(mockPreview);
      expect(previewService.getOrganizationSubscriptionPreview).toHaveBeenCalledWith("org-123");
    });

    it("should propagate errors from SubscriptionPreviewService", async () => {
      const error = new Error("Preview fetch failed");
      previewService.getOrganizationSubscriptionPreview.mockRejectedValue(error);

      await expect(service.getSubscriptionPreview("org-123")).rejects.toThrow(error);
    });
  });
});

/**
 * Builds a real Organization from backing fields so the fetch gate exercises the actual getters
 * (canViewSubscription, hasProvider/hasReseller, isOwner) rather than plain-property stand-ins.
 */
function createOrganization(
  config: {
    type?: OrganizationUserType;
    isProviderUser?: boolean;
    isOwner?: boolean;
    productTierType?: ProductTierType;
    hasProvider?: boolean;
    hasBillableProvider?: boolean;
    hasReseller?: boolean;
  } = {},
): Organization {
  const org = new Organization();
  org.id = "org-123" as any;
  org.type = config.type ?? OrganizationUserType.User;
  org.isProviderUser = config.isProviderUser ?? false;
  org.isMember = true;
  org.productTierType = config.productTierType ?? ProductTierType.Teams;

  const needsProvider = config.hasProvider || config.hasBillableProvider || config.hasReseller;
  if (needsProvider) {
    org.providerId = "provider-id" as any;
    org.providerName = "Provider";
  }
  if (config.hasBillableProvider) {
    org.providerType = ProviderType.Msp;
  } else if (config.hasReseller) {
    org.providerType = ProviderType.Reseller;
  }
  if (config.isOwner && !config.isProviderUser) {
    org.type = OrganizationUserType.Owner;
  }
  org.permissions = null as any;
  return org;
}
