import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { OrganizationWarningsService } from "../../../billing/organizations/warnings/services/organization-warnings.service";
import { FreeFamiliesPolicyService } from "../../../billing/services/free-families-policy.service";

import { OrganizationLayoutComponent } from "./organization-layout.component";

describe("OrganizationLayoutComponent", () => {
  let fixture: ComponentFixture<OrganizationLayoutComponent>;
  let component: OrganizationLayoutComponent;

  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockProviderService: MockProxy<ProviderService>;
  let mockFreeFamiliesPolicyService: MockProxy<FreeFamiliesPolicyService>;
  let mockOrganizationWarningsService: MockProxy<OrganizationWarningsService>;
  let mockAccountService: ReturnType<typeof mockAccountServiceWith>;

  let routeParamsSubject: BehaviorSubject<{ organizationId: OrganizationId }>;

  const userId = "test-user-id" as UserId;
  const orgId = "org-1" as OrganizationId;

  function makeOrg(overrides: Partial<Organization> = {}): Organization {
    return {
      id: orgId,
      name: "Acme Corp",
      enabled: true,
      isOwner: true,
      isAdmin: false,
      canManageUsers: true,
      canManageGroups: true,
      canViewAllCollections: true,
      canAccessReports: true,
      canAccessEventLogs: true,
      canAccessExport: true,
      canViewBillingHistory: true,
      canEditPaymentMethods: true,
      canManagePolicies: false,
      canManageSso: false,
      canManageScim: false,
      canAccessImport: false,
      canManageDeviceApprovals: false,
      canManageUsersPassword: false,
      canAccessIntegrations: true,
      canUseAccessIntelligence: true,
      useEvents: false,
      hasProvider: false,
      providerId: undefined,
      ...overrides,
    } as unknown as Organization;
  }

  function makeProvider(overrides: Partial<Provider> = {}): Provider {
    return {
      id: "provider-1",
      providerStatus: ProviderStatusType.Billable,
      ...overrides,
    } as Provider;
  }

  beforeEach(async () => {
    routeParamsSubject = new BehaviorSubject({ organizationId: orgId });

    mockOrganizationService = mock<OrganizationService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockPolicyService = mock<PolicyService>();
    mockProviderService = mock<ProviderService>();
    mockFreeFamiliesPolicyService = mock<FreeFamiliesPolicyService>();
    mockOrganizationWarningsService = mock<OrganizationWarningsService>();
    mockAccountService = mockAccountServiceWith(userId);

    mockOrganizationService.organizations$.mockReturnValue(of([makeOrg()]));
    mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
    mockPolicyService.policyAppliesToUser$.mockReturnValue(of(false));
    mockProviderService.get$.mockReturnValue(of(undefined));
    mockFreeFamiliesPolicyService.showSponsoredFamiliesDropdown$.mockReturnValue(of(false));
    mockOrganizationWarningsService.getTaxIdWarning$.mockReturnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [OrganizationLayoutComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: routeParamsSubject.asObservable() } },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: ProviderService, useValue: mockProviderService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: FreeFamiliesPolicyService, useValue: mockFreeFamiliesPolicyService },
        { provide: OrganizationWarningsService, useValue: mockOrganizationWarningsService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(OrganizationLayoutComponent, {
        set: { template: "", imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OrganizationLayoutComponent);
    component = fixture.componentInstance;
  });

  describe("organization$", () => {
    it("emits the organization matching the route param", async () => {
      const org = makeOrg({ name: "Test Org" });
      mockOrganizationService.organizations$.mockReturnValue(of([org]));
      routeParamsSubject.next({ organizationId: orgId });

      const result = await firstValueFrom(component.organization$);
      expect(result.id).toBe(orgId);
    });
  });

  describe("canAccessExport$", () => {
    it("emits true when org.canAccessExport is true", async () => {
      mockOrganizationService.organizations$.mockReturnValue(
        of([makeOrg({ canAccessExport: true })]),
      );
      const result = await firstValueFrom(component.canAccessExport$);
      expect(result).toBe(true);
    });

    it("emits false when org.canAccessExport is false", async () => {
      mockOrganizationService.organizations$.mockReturnValue(
        of([makeOrg({ canAccessExport: false })]),
      );
      const result = await firstValueFrom(component.canAccessExport$);
      expect(result).toBe(false);
    });
  });

  describe("showPaymentAndHistory$", () => {
    it("is true when not self-host, canViewBillingHistory, and canEditPaymentMethods", async () => {
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockOrganizationService.organizations$.mockReturnValue(
        of([makeOrg({ canViewBillingHistory: true, canEditPaymentMethods: true })]),
      );
      const result = await firstValueFrom(component.showPaymentAndHistory$);
      expect(result).toBe(true);
    });

    describe("organizationIsUnmanaged$", () => {
      it("is true when org has no provider", async () => {
        mockOrganizationService.organizations$.mockReturnValue(
          of([makeOrg({ hasProvider: false, providerId: undefined })]),
        );
        mockProviderService.get$.mockReturnValue(of(undefined));
        const result = await firstValueFrom(component.organizationIsUnmanaged$);
        expect(result).toBe(true);
      });

      it("is true when provider is undefined", async () => {
        mockOrganizationService.organizations$.mockReturnValue(
          of([makeOrg({ hasProvider: true, providerId: "p-1" })]),
        );
        mockProviderService.get$.mockReturnValue(of(undefined));
        const result = await firstValueFrom(component.organizationIsUnmanaged$);
        expect(result).toBe(true);
      });

      it("is true when provider status is not Billable", async () => {
        mockOrganizationService.organizations$.mockReturnValue(
          of([makeOrg({ hasProvider: true, providerId: "p-1" })]),
        );
        mockProviderService.get$.mockReturnValue(
          of(makeProvider({ providerStatus: ProviderStatusType.Pending })),
        );
        const result = await firstValueFrom(component.organizationIsUnmanaged$);
        expect(result).toBe(true);
      });

      it("is false when org has a Billable provider", async () => {
        mockOrganizationService.organizations$.mockReturnValue(
          of([makeOrg({ hasProvider: true, providerId: "p-1" })]),
        );
        mockProviderService.get$.mockReturnValue(
          of(makeProvider({ providerStatus: ProviderStatusType.Billable })),
        );
        const result = await firstValueFrom(component.organizationIsUnmanaged$);
        expect(result).toBe(false);
      });
    });

    describe("canShowVaultTab", () => {
      it("returns true when canViewAllCollections", () => {
        expect(component.canShowVaultTab(makeOrg({ canViewAllCollections: true }))).toBe(true);
      });

      it("returns false when canViewAllCollections is false", () => {
        expect(component.canShowVaultTab(makeOrg({ canViewAllCollections: false }))).toBe(false);
      });
    });

    describe("canShowSettingsTab", () => {
      it("returns true when org.isOwner", () => {
        expect(component.canShowSettingsTab(makeOrg({ isOwner: true }))).toBe(true);
      });

      it("returns false when no settings permissions", () => {
        const org = makeOrg({
          isOwner: false,
          canManagePolicies: false,
          canManageSso: false,
          canManageScim: false,
          canAccessImport: false,
          canAccessExport: false,
          canManageDeviceApprovals: false,
        });
        expect(component.canShowSettingsTab(org)).toBe(false);
      });
    });

    describe("canShowMembersTab", () => {
      it("returns true when canManageUsers", () => {
        expect(component.canShowMembersTab(makeOrg({ canManageUsers: true }))).toBe(true);
      });

      it("returns false when no member management permissions", () => {
        const org = makeOrg({ canManageUsers: false, canManageUsersPassword: false });
        expect(component.canShowMembersTab(org)).toBe(false);
      });
    });

    describe("canShowGroupsTab", () => {
      it("returns true when canManageGroups", () => {
        expect(component.canShowGroupsTab(makeOrg({ canManageGroups: true }))).toBe(true);
      });

      it("returns false when canManageGroups is false", () => {
        expect(component.canShowGroupsTab(makeOrg({ canManageGroups: false }))).toBe(false);
      });
    });

    describe("canShowReportsTab", () => {
      it("returns true when canAccessReports", () => {
        expect(component.canShowReportsTab(makeOrg({ canAccessReports: true }))).toBe(true);
      });

      it("returns true when canAccessEventLogs", () => {
        const org = makeOrg({ canAccessReports: false, canAccessEventLogs: true });
        expect(component.canShowReportsTab(org)).toBe(true);
      });

      it("returns false when neither canAccessReports nor canAccessEventLogs", () => {
        const org = makeOrg({ canAccessReports: false, canAccessEventLogs: false });
        expect(component.canShowReportsTab(org)).toBe(false);
      });
    });

    describe("canShowBillingTab", () => {
      it("returns true when isOwner", () => {
        expect(component.canShowBillingTab(makeOrg({ isOwner: true }))).toBe(true);
      });

      it("returns false when not owner", () => {
        expect(component.canShowBillingTab(makeOrg({ isOwner: false }))).toBe(false);
      });
    });

    describe("canShowAccessIntelligenceTab", () => {
      it("returns true when canUseAccessIntelligence and canAccessReports", () => {
        const org = makeOrg({ canUseAccessIntelligence: true, canAccessReports: true });
        expect(component.canShowAccessIntelligenceTab(org)).toBe(true);
      });

      it("returns false when canUseAccessIntelligence is false", () => {
        const org = makeOrg({ canUseAccessIntelligence: false, canAccessReports: true });
        expect(component.canShowAccessIntelligenceTab(org)).toBe(false);
      });

      it("returns false when canAccessReports is false", () => {
        const org = makeOrg({ canUseAccessIntelligence: true, canAccessReports: false });
        expect(component.canShowAccessIntelligenceTab(org)).toBe(false);
      });
    });

    describe("getReportTabLabel", () => {
      it("returns 'reporting' when org.useEvents is true", () => {
        expect(component.getReportTabLabel(makeOrg({ useEvents: true }))).toBe("reporting");
      });

      it("returns 'reports' when org.useEvents is false", () => {
        expect(component.getReportTabLabel(makeOrg({ useEvents: false }))).toBe("reports");
      });
    });

    describe("refreshTaxIdWarning", () => {
      it("delegates to organizationWarningsService.refreshTaxIdWarning", () => {
        component.refreshTaxIdWarning();
        expect(mockOrganizationWarningsService.refreshTaxIdWarning).toHaveBeenCalled();
      });
    });
  });
});
