import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PoliciesComponent } from "./policies.component";
import { SingleOrgPolicy } from "./policy-edit-definitions/single-org.component";
import { PolicyEditDialogComponent } from "./policy-edit-dialog.component";
import { PolicyListService } from "./policy-list.service";
import { POLICY_EDIT_REGISTER } from "./policy-register-token";

describe("PoliciesComponent", () => {
  let component: PoliciesComponent;
  let fixture: ComponentFixture<PoliciesComponent>;

  let mockActivatedRoute: ActivatedRoute;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockAccountService: FakeAccountService;
  let mockPolicyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let mockPolicyListService: MockProxy<PolicyListService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;

  let routeParamsSubject: BehaviorSubject<any>;
  let queryParamsSubject: BehaviorSubject<any>;

  const mockUserId = newGuid() as UserId;
  const mockOrgId = newGuid() as OrganizationId;
  const mockOrg = {
    id: mockOrgId,
    name: "Test Organization",
    enabled: true,
  } as Organization;

  const mockPolicyResponse = {
    id: newGuid(),
    enabled: true,
    object: "policy",
    organizationId: mockOrgId,
    type: PolicyType.SingleOrg,
    data: null,
  };

  const mockPolicy = new SingleOrgPolicy();

  beforeEach(async () => {
    routeParamsSubject = new BehaviorSubject({ organizationId: mockOrgId });
    queryParamsSubject = new BehaviorSubject({});

    mockActivatedRoute = {
      params: routeParamsSubject.asObservable(),
      queryParams: queryParamsSubject.asObservable(),
    } as any;

    mockOrganizationService = mock<OrganizationService>();
    mockOrganizationService.organizations$.mockReturnValue(of([mockOrg]));

    mockAccountService = mockAccountServiceWith(mockUserId);

    mockPolicyApiService = mock<PolicyApiServiceAbstraction>();
    mockPolicyApiService.getPolicies.mockResolvedValue(
      new ListResponse({ Data: [mockPolicyResponse], ContinuationToken: null }, PolicyResponse),
    );

    mockPolicyListService = mock<PolicyListService>();
    mockPolicyListService.getPolicies.mockReturnValue([mockPolicy]);

    mockDialogService = mock<DialogService>();
    mockDialogService.open.mockReturnValue({ close: jest.fn() } as any);

    mockPolicyService = mock<PolicyService>();
    mockPolicyService.policies$.mockReturnValue(of([]));

    mockConfigService = mock<ConfigService>();
    mockI18nService = mock<I18nService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();

    jest.spyOn(PolicyEditDialogComponent, "open").mockReturnValue({ close: jest.fn() } as any);

    await TestBed.configureTestingModule({
      imports: [PoliciesComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
        { provide: PolicyListService, useValue: mockPolicyListService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: POLICY_EDIT_REGISTER, useValue: [] },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(PoliciesComponent, {
        remove: { imports: [] },
        add: { template: "<div></div>" },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PoliciesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (fixture) {
      fixture.destroy();
    }
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("organizationId$", () => {
    it("should extract organizationId from route params", async () => {
      const orgId = await firstValueFrom(component.organizationId$);
      expect(orgId).toBe(mockOrgId);
    });

    it("should emit new organizationId when route params change", (done) => {
      const newOrgId = newGuid() as OrganizationId;
      const emittedValues: OrganizationId[] = [];

      const subscription = component.organizationId$.subscribe((orgId) => {
        emittedValues.push(orgId);

        if (emittedValues.length === 2) {
          expect(emittedValues[0]).toBe(mockOrgId);
          expect(emittedValues[1]).toBe(newOrgId);
          subscription.unsubscribe();
          done();
        }
      });

      routeParamsSubject.next({ organizationId: newOrgId });
    });
  });

  describe("organization$", () => {
    it("should retrieve organization for current user and organizationId", async () => {
      const org = await firstValueFrom(component.organization$);
      expect(org).toBe(mockOrg);
      expect(mockOrganizationService.organizations$).toHaveBeenCalledWith(mockUserId);
    });

    it("should throw error when organization is not found", async () => {
      mockOrganizationService.organizations$.mockReturnValue(of([]));

      await expect(firstValueFrom(component.organization$)).rejects.toThrow(
        "No organization found for provided userId",
      );
    });
  });

  describe("policies$", () => {
    it("should return policies from PolicyListService", async () => {
      const policies = await firstValueFrom(component.policies$);

      expect(policies).toBeDefined();
      expect(Array.isArray(policies)).toBe(true);
    });
  });

  describe("orgPolicies$", () => {
    it("should fetch policies from API for current organization", async () => {
      const mockPolicyResponsesData = [
        {
          id: newGuid(),
          organizationId: mockOrgId,
          type: PolicyType.TwoFactorAuthentication,
          enabled: true,
          data: null,
        },
        {
          id: newGuid(),
          organizationId: mockOrgId,
          type: PolicyType.RequireSso,
          enabled: false,
          data: null,
        },
      ];

      const listResponse = new ListResponse(
        { Data: mockPolicyResponsesData, ContinuationToken: null },
        PolicyResponse,
      );

      mockPolicyApiService.getPolicies.mockResolvedValue(listResponse);

      const policies = await firstValueFrom(component["orgPolicies$"]);
      expect(policies).toEqual(listResponse.data);
      expect(mockPolicyApiService.getPolicies).toHaveBeenCalledWith(mockOrgId);
    });

    it("should return empty array when API returns no data", async () => {
      mockPolicyApiService.getPolicies.mockResolvedValue(
        new ListResponse({ Data: [], ContinuationToken: null }, PolicyResponse),
      );

      const policies = await firstValueFrom(component["orgPolicies$"]);
      expect(policies).toEqual([]);
    });

    it("should return empty array when API returns null data", async () => {
      mockPolicyApiService.getPolicies.mockResolvedValue(
        new ListResponse({ Data: null, ContinuationToken: null }, PolicyResponse),
      );

      const policies = await firstValueFrom(component["orgPolicies$"]);
      expect(policies).toEqual([]);
    });
  });

  describe("policiesEnabledMap$", () => {
    it("should create a map of policy types to their enabled status", async () => {
      const mockPolicyResponsesData = [
        {
          id: "policy-1",
          organizationId: mockOrgId,
          type: PolicyType.TwoFactorAuthentication,
          enabled: true,
          data: null,
        },
        {
          id: "policy-2",
          organizationId: mockOrgId,
          type: PolicyType.RequireSso,
          enabled: false,
          data: null,
        },
        {
          id: "policy-3",
          organizationId: mockOrgId,
          type: PolicyType.SingleOrg,
          enabled: true,
          data: null,
        },
      ];

      mockPolicyApiService.getPolicies.mockResolvedValue(
        new ListResponse(
          { Data: mockPolicyResponsesData, ContinuationToken: null },
          PolicyResponse,
        ),
      );

      const map = await firstValueFrom(component.policiesEnabledMap$);
      expect(map.size).toBe(3);
      expect(map.get(PolicyType.TwoFactorAuthentication)).toBe(true);
      expect(map.get(PolicyType.RequireSso)).toBe(false);
      expect(map.get(PolicyType.SingleOrg)).toBe(true);
    });

    it("should create empty map when no policies exist", async () => {
      mockPolicyApiService.getPolicies.mockResolvedValue(
        new ListResponse({ Data: [], ContinuationToken: null }, PolicyResponse),
      );

      const map = await firstValueFrom(component.policiesEnabledMap$);
      expect(map.size).toBe(0);
    });
  });

  describe("constructor subscription", () => {
    it("should subscribe to policyService.policies$ on initialization", () => {
      expect(mockPolicyService.policies$).toHaveBeenCalledWith(mockUserId);
    });

    it("should refresh policies when policyService emits", async () => {
      const policiesSubject = new BehaviorSubject<any[]>([]);
      mockPolicyService.policies$.mockReturnValue(policiesSubject.asObservable());

      let callCount = 0;
      mockPolicyApiService.getPolicies.mockImplementation(() => {
        callCount++;
        return of(new ListResponse({ Data: [], ContinuationToken: null }, PolicyResponse));
      });

      const newFixture = TestBed.createComponent(PoliciesComponent);
      newFixture.detectChanges();

      const initialCallCount = callCount;

      policiesSubject.next([{ type: PolicyType.TwoFactorAuthentication }]);

      expect(callCount).toBeGreaterThan(initialCallCount);

      newFixture.destroy();
    });
  });

  describe("handleLaunchEvent", () => {
    it("should open policy dialog when policyId is in query params", async () => {
      const mockPolicyId = newGuid();
      const mockPolicy: BasePolicyEditDefinition = {
        name: "Test Policy",
        description: "Test Description",
        type: PolicyType.TwoFactorAuthentication,
        component: {} as any,
        showDescription: true,
        display$: () => of(true),
      };

      const mockPolicyResponseData = {
        id: mockPolicyId,
        organizationId: mockOrgId,
        type: PolicyType.TwoFactorAuthentication,
        enabled: true,
        data: null,
      };

      queryParamsSubject.next({ policyId: mockPolicyId });

      mockPolicyApiService.getPolicies.mockReturnValue(
        of(
          new ListResponse(
            { Data: [mockPolicyResponseData], ContinuationToken: null },
            PolicyResponse,
          ),
        ),
      );

      const dialogOpenSpy = jest
        .spyOn(PolicyEditDialogComponent, "open")
        .mockReturnValue({ close: jest.fn() } as any);

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [PoliciesComponent],
        providers: [
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          { provide: OrganizationService, useValue: mockOrganizationService },
          { provide: AccountService, useValue: mockAccountService },
          { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
          { provide: PolicyListService, useValue: mockPolicyListService },
          { provide: DialogService, useValue: mockDialogService },
          { provide: PolicyService, useValue: mockPolicyService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: I18nService, useValue: mockI18nService },
          { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
          { provide: POLICY_EDIT_REGISTER, useValue: [mockPolicy] },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      })
        .overrideComponent(PoliciesComponent, {
          remove: { imports: [] },
          add: { template: "<div></div>" },
        })
        .compileComponents();

      const newFixture = TestBed.createComponent(PoliciesComponent);
      newFixture.detectChanges();

      expect(dialogOpenSpy).toHaveBeenCalled();
      const callArgs = dialogOpenSpy.mock.calls[0][1];
      expect(callArgs.data?.policy.type).toBe(mockPolicy.type);
      expect(callArgs.data?.organizationId).toBe(mockOrgId);

      newFixture.destroy();
    });

    it("should not open dialog when policyId is not in query params", async () => {
      const editSpy = jest.spyOn(component, "edit");

      queryParamsSubject.next({});

      expect(editSpy).not.toHaveBeenCalled();
    });

    it("should not open dialog when policyId does not match any org policy", async () => {
      const mockPolicy: BasePolicyEditDefinition = {
        name: "Test Policy",
        description: "Test Description",
        type: PolicyType.TwoFactorAuthentication,
        component: {} as any,
        showDescription: true,
        display$: () => of(true),
      };

      mockPolicyListService.getPolicies.mockReturnValue([mockPolicy]);
      mockPolicyApiService.getPolicies.mockResolvedValue(
        new ListResponse({ Data: [], ContinuationToken: null }, PolicyResponse),
      );

      const editSpy = jest.spyOn(component, "edit");

      queryParamsSubject.next({ policyId: "non-existent-policy-id" });

      expect(editSpy).not.toHaveBeenCalled();
    });
  });

  describe("edit", () => {
    it("should call dialogService.open with correct parameters when no custom dialog is specified", () => {
      const mockPolicy: BasePolicyEditDefinition = {
        name: "Test Policy",
        description: "Test Description",
        type: PolicyType.TwoFactorAuthentication,
        component: {} as any,
        showDescription: true,
        display$: () => of(true),
      };

      const openSpy = jest.spyOn(PolicyEditDialogComponent, "open");

      component.edit(mockPolicy, mockOrgId);

      expect(openSpy).toHaveBeenCalled();
      const callArgs = openSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({
        data: {
          policy: mockPolicy,
          organizationId: mockOrgId,
        },
      });
    });

    it("should call custom dialog open method when specified", () => {
      const mockDialogRef = { close: jest.fn() };
      const mockCustomDialog = {
        open: jest.fn().mockReturnValue(mockDialogRef),
      };

      const mockPolicy: BasePolicyEditDefinition = {
        name: "Custom Policy",
        description: "Custom Description",
        type: PolicyType.RequireSso,
        component: {} as any,
        editDialogComponent: mockCustomDialog as any,
        showDescription: true,
        display$: () => of(true),
      };

      component.edit(mockPolicy, mockOrgId);

      expect(mockCustomDialog.open).toHaveBeenCalled();
      const callArgs = mockCustomDialog.open.mock.calls[0];
      expect(callArgs[1]).toEqual({
        data: {
          policy: mockPolicy,
          organizationId: mockOrgId,
        },
      });
      expect(PolicyEditDialogComponent.open).not.toHaveBeenCalled();
    });

    it("should pass correct organizationId to dialog", () => {
      const customOrgId = newGuid() as OrganizationId;
      const mockPolicy: BasePolicyEditDefinition = {
        name: "Test Policy",
        description: "Test Description",
        type: PolicyType.SingleOrg,
        component: {} as any,
        showDescription: true,
        display$: () => of(true),
      };

      const openSpy = jest.spyOn(PolicyEditDialogComponent, "open");

      component.edit(mockPolicy, customOrgId);

      expect(openSpy).toHaveBeenCalled();
      const callArgs = openSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({
        data: {
          policy: mockPolicy,
          organizationId: customOrgId,
        },
      });
    });
  });

  describe("loading signal", () => {
    it("should initialize loading as false", () => {
      expect(component["loading"]()).toBe(false);
    });
  });
});
