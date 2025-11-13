import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, throwError } from "rxjs";

import {
  DefaultOrganizationUserService,
  OrganizationUserApiService,
  OrganizationUserConfirmRequest,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";

import { AUTO_CONFIRM_STATE, AutoConfirmState } from "../models/auto-confirm-state.model";

import { DefaultAutomaticUserConfirmationService } from "./default-auto-confirm.service";

describe("DefaultAutomaticUserConfirmationService", () => {
  let service: DefaultAutomaticUserConfirmationService;
  let configService: MockProxy<ConfigService>;
  let apiService: MockProxy<ApiService>;
  let organizationUserService: MockProxy<DefaultOrganizationUserService>;
  let stateProvider: FakeStateProvider;
  let organizationService: MockProxy<InternalOrganizationServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let policyService: MockProxy<PolicyService>;

  const mockUserId = newGuid() as UserId;
  const mockConfirmingUserId = newGuid() as UserId;
  const mockOrganizationId = newGuid() as OrganizationId;
  let mockOrganization: Organization;

  beforeEach(() => {
    configService = mock<ConfigService>();
    apiService = mock<ApiService>();
    organizationUserService = mock<DefaultOrganizationUserService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(mockUserId));
    organizationService = mock<InternalOrganizationServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    policyService = mock<PolicyService>();

    TestBed.configureTestingModule({
      providers: [
        DefaultAutomaticUserConfirmationService,
        { provide: ConfigService, useValue: configService },
        { provide: ApiService, useValue: apiService },
        { provide: DefaultOrganizationUserService, useValue: organizationUserService },
        { provide: "StateProvider", useValue: stateProvider },
        {
          provide: InternalOrganizationServiceAbstraction,
          useValue: organizationService,
        },
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: PolicyService, useValue: policyService },
      ],
    });

    service = new DefaultAutomaticUserConfirmationService(
      configService,
      apiService,
      organizationUserService,
      stateProvider,
      organizationService,
      organizationUserApiService,
      policyService,
    );

    const mockOrgData = new OrganizationData({} as ProfileOrganizationResponse, {
      isMember: true,
      isProviderUser: false,
    });
    mockOrgData.id = mockOrganizationId;
    mockOrgData.useAutomaticUserConfirmation = true;

    const permissions = new PermissionsApi();
    permissions.manageUsers = true;
    mockOrgData.permissions = permissions;

    mockOrganization = new Organization(mockOrgData);
  });

  describe("configuration$", () => {
    it("should return default AutoConfirmState when no state exists", async () => {
      const config$ = service.configuration$(mockUserId);
      const config = await firstValueFrom(config$);

      expect(config).toBeInstanceOf(AutoConfirmState);
      expect(config.enabled).toBe(false);
      expect(config.showSetupDialog).toBe(true);
    });

    it("should return stored AutoConfirmState when state exists", async () => {
      const expectedConfig = new AutoConfirmState();
      expectedConfig.enabled = true;
      expectedConfig.showSetupDialog = false;
      expectedConfig.showBrowserNotification = true;

      await stateProvider.setUserState(
        AUTO_CONFIRM_STATE,
        { [mockUserId]: expectedConfig },
        mockUserId,
      );

      const config$ = service.configuration$(mockUserId);
      const config = await firstValueFrom(config$);

      expect(config.enabled).toBe(true);
      expect(config.showSetupDialog).toBe(false);
      expect(config.showBrowserNotification).toBe(true);
    });

    it("should emit updates when state changes", async () => {
      const config$ = service.configuration$(mockUserId);
      const configs: AutoConfirmState[] = [];

      const subscription = config$.subscribe((config) => configs.push(config));

      expect(configs[0].enabled).toBe(false);

      const newConfig = new AutoConfirmState();
      newConfig.enabled = true;
      await stateProvider.setUserState(AUTO_CONFIRM_STATE, { [mockUserId]: newConfig }, mockUserId);

      expect(configs.length).toBeGreaterThan(1);
      expect(configs[configs.length - 1].enabled).toBe(true);

      subscription.unsubscribe();
    });
  });

  describe("upsert", () => {
    it("should store new configuration for user", async () => {
      const newConfig = new AutoConfirmState();
      newConfig.enabled = true;
      newConfig.showSetupDialog = false;

      await service.upsert(mockUserId, newConfig);

      const storedState = await firstValueFrom(
        stateProvider.getUser(mockUserId, AUTO_CONFIRM_STATE).state$,
      );

      expect(storedState != null);
      expect(storedState![mockUserId]).toEqual(newConfig);
    });

    it("should update existing configuration for user", async () => {
      const initialConfig = new AutoConfirmState();
      initialConfig.enabled = false;

      await service.upsert(mockUserId, initialConfig);

      const updatedConfig = new AutoConfirmState();
      updatedConfig.enabled = true;
      updatedConfig.showSetupDialog = false;

      await service.upsert(mockUserId, updatedConfig);

      const storedState = await firstValueFrom(
        stateProvider.getUser(mockUserId, AUTO_CONFIRM_STATE).state$,
      );

      expect(storedState != null);
      expect(storedState![mockUserId].enabled).toBe(true);
      expect(storedState![mockUserId].showSetupDialog).toBe(false);
    });

    it("should preserve other user configurations when updating", async () => {
      const otherUserId = newGuid() as UserId;
      const otherConfig = new AutoConfirmState();
      otherConfig.enabled = true;

      await stateProvider.setUserState(
        AUTO_CONFIRM_STATE,
        { [otherUserId]: otherConfig },
        mockUserId,
      );

      const newConfig = new AutoConfirmState();
      newConfig.enabled = false;

      await service.upsert(mockUserId, newConfig);

      const storedState = await firstValueFrom(
        stateProvider.getUser(mockUserId, AUTO_CONFIRM_STATE).state$,
      );

      expect(storedState != null);
      expect(storedState![mockUserId]).toEqual(newConfig);
      expect(storedState![otherUserId]).toEqual(otherConfig);
    });
  });

  describe("canManageAutoConfirm$", () => {
    beforeEach(() => {
      const organizations$ = new BehaviorSubject<Organization[]>([mockOrganization]);
      organizationService.organizations$.mockReturnValue(organizations$);
      policyService.policyAppliesToUser$.mockReturnValue(of(true));
    });

    it("should return true when feature flag is enabled and organization allows management", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(true);
    });

    it("should return false when feature flag is disabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return false when organization canManageUsers is false", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));

      // Create organization without manageUsers permission
      const mockOrgData = new OrganizationData({} as ProfileOrganizationResponse, {
        isMember: true,
        isProviderUser: false,
      });
      mockOrgData.id = mockOrganizationId;
      mockOrgData.useAutomaticUserConfirmation = true;
      const permissions = new PermissionsApi();
      permissions.manageUsers = false;
      mockOrgData.permissions = permissions;
      const orgWithoutManageUsers = new Organization(mockOrgData);

      const organizations$ = new BehaviorSubject<Organization[]>([orgWithoutManageUsers]);
      organizationService.organizations$.mockReturnValue(organizations$);

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return false when organization useAutomaticUserConfirmation is false", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));

      // Create organization without useAutomaticUserConfirmation
      const mockOrgData = new OrganizationData({} as ProfileOrganizationResponse, {
        isMember: true,
        isProviderUser: false,
      });
      mockOrgData.id = mockOrganizationId;
      mockOrgData.useAutomaticUserConfirmation = false;
      const permissions = new PermissionsApi();
      permissions.manageUsers = true;
      mockOrgData.permissions = permissions;
      const orgWithoutAutoConfirm = new Organization(mockOrgData);

      const organizations$ = new BehaviorSubject<Organization[]>([orgWithoutAutoConfirm]);
      organizationService.organizations$.mockReturnValue(organizations$);

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return false when organization is not found", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));

      const organizations$ = new BehaviorSubject<Organization[]>([]);
      organizationService.organizations$.mockReturnValue(organizations$);

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should use the correct feature flag", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      await firstValueFrom(canManage$);

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.AutoConfirm);
    });

    it("should return false when policy does not apply to user", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      policyService.policyAppliesToUser$.mockReturnValue(of(false));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return true when policy applies to user", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(true);
    });

    it("should check policy with correct PolicyType and userId", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      await firstValueFrom(canManage$);

      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutoConfirm,
        mockUserId,
      );
    });

    it("should return false when feature flag is enabled but policy does not apply", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      policyService.policyAppliesToUser$.mockReturnValue(of(false));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutoConfirm,
        mockUserId,
      );
    });
  });

  describe("autoConfirmUser", () => {
    const mockPublicKey = "mock-public-key-base64";
    const mockPublicKeyArray = new Uint8Array([1, 2, 3, 4]);
    const mockConfirmRequest = {
      key: "encrypted-key",
      defaultUserCollectionName: "encrypted-collection",
    } as OrganizationUserConfirmRequest;

    beforeEach(() => {
      const organizations$ = new BehaviorSubject<Organization[]>([mockOrganization]);
      organizationService.organizations$.mockReturnValue(organizations$);
      configService.getFeatureFlag$.mockReturnValue(of(true));
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      apiService.getUserPublicKey.mockResolvedValue({
        publicKey: mockPublicKey,
      } as UserKeyResponse);
      jest.spyOn(Utils, "fromB64ToArray").mockReturnValue(mockPublicKeyArray);
      organizationUserService.buildConfirmRequest.mockReturnValue(of(mockConfirmRequest));
      organizationUserApiService.postOrganizationUserConfirm.mockResolvedValue(undefined);
    });

    it("should successfully auto-confirm a user", async () => {
      await service.autoConfirmUser(mockUserId, mockConfirmingUserId, mockOrganization);

      expect(apiService.getUserPublicKey).toHaveBeenCalledWith(mockUserId);
      expect(organizationUserService.buildConfirmRequest).toHaveBeenCalledWith(
        mockOrganization,
        mockPublicKeyArray,
      );
      expect(organizationUserApiService.postOrganizationUserConfirm).toHaveBeenCalledWith(
        mockOrganizationId,
        mockConfirmingUserId,
        mockConfirmRequest,
      );
    });

    it("should not confirm user when canManageAutoConfirm returns false", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));

      await expect(
        service.autoConfirmUser(mockUserId, mockConfirmingUserId, mockOrganization),
      ).rejects.toThrow("Cannot automatically confirm user (insufficient permissions)");

      expect(apiService.getUserPublicKey).not.toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserConfirm).not.toHaveBeenCalled();
    });

    it("should build confirm request with organization and public key", async () => {
      await service.autoConfirmUser(mockUserId, mockConfirmingUserId, mockOrganization);

      expect(organizationUserService.buildConfirmRequest).toHaveBeenCalledWith(
        mockOrganization,
        mockPublicKeyArray,
      );
    });

    it("should call API with correct parameters", async () => {
      await service.autoConfirmUser(mockUserId, mockConfirmingUserId, mockOrganization);

      expect(organizationUserApiService.postOrganizationUserConfirm).toHaveBeenCalledWith(
        mockOrganization.id,
        mockConfirmingUserId,
        mockConfirmRequest,
      );
    });

    it("should handle API errors gracefully", async () => {
      const apiError = new Error("API Error");
      apiService.getUserPublicKey.mockRejectedValue(apiError);

      await expect(
        service.autoConfirmUser(mockUserId, mockConfirmingUserId, mockOrganization),
      ).rejects.toThrow("API Error");

      expect(organizationUserApiService.postOrganizationUserConfirm).not.toHaveBeenCalled();
    });

    it("should handle buildConfirmRequest errors gracefully", async () => {
      const buildError = new Error("Build Error");
      organizationUserService.buildConfirmRequest.mockReturnValue(throwError(() => buildError));

      await expect(
        service.autoConfirmUser(mockUserId, mockConfirmingUserId, mockOrganization),
      ).rejects.toThrow("Build Error");

      expect(organizationUserApiService.postOrganizationUserConfirm).not.toHaveBeenCalled();
    });
  });
});
