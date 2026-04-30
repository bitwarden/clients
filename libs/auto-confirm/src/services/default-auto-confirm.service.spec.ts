import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, throwError } from "rxjs";

import {
  DefaultOrganizationUserService,
  OrganizationUserApiService,
  OrganizationUserBulkConfirmRequest,
  OrganizationUserConfirmRequest,
  OrganizationUserPendingAutoConfirmResponse,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
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
  let apiService: MockProxy<ApiService>;
  let organizationUserService: MockProxy<DefaultOrganizationUserService>;
  let stateProvider: FakeStateProvider;
  let organizationService: MockProxy<InternalOrganizationServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let policyService: MockProxy<PolicyService>;
  let authService: MockProxy<AuthService>;
  let accountService: MockProxy<AccountService>;
  let configService: MockProxy<ConfigService>;

  const mockUserId = newGuid() as UserId;
  const mockConfirmingUserId = newGuid() as UserId;
  const mockConfirmingOrganizationUserId = newGuid() as UserId;
  const mockOrganizationId = newGuid() as OrganizationId;
  let mockOrganization: Organization;

  beforeEach(() => {
    apiService = mock<ApiService>();
    organizationUserService = mock<DefaultOrganizationUserService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(mockUserId));
    organizationService = mock<InternalOrganizationServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    policyService = mock<PolicyService>();
    authService = mock<AuthService>();
    accountService = mock<AccountService>();
    configService = mock<ConfigService>();

    // Provide stable defaults for the auth unlock subscription in the constructor
    accountService.accounts$ = of({});

    TestBed.configureTestingModule({
      providers: [
        DefaultAutomaticUserConfirmationService,
        { provide: ApiService, useValue: apiService },
        { provide: DefaultOrganizationUserService, useValue: organizationUserService },
        { provide: "StateProvider", useValue: stateProvider },
        {
          provide: InternalOrganizationServiceAbstraction,
          useValue: organizationService,
        },
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: PolicyService, useValue: policyService },
        { provide: AuthService, useValue: authService },
        { provide: AccountService, useValue: accountService },
        { provide: ConfigService, useValue: configService },
      ],
    });

    service = new DefaultAutomaticUserConfirmationService(
      apiService,
      organizationUserService,
      stateProvider,
      organizationService,
      organizationUserApiService,
      policyService,
      authService,
      accountService,
      configService,
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

    it("should return true when organization allows management", async () => {
      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(true);
    });

    it("should return false when organization canManageUsers is false", async () => {
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
      const organizations$ = new BehaviorSubject<Organization[]>([]);
      organizationService.organizations$.mockReturnValue(organizations$);

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return false when the user is not a member of any organizations", async () => {
      // Create organization where user is not a member
      const mockOrgData = new OrganizationData({} as ProfileOrganizationResponse, {
        isMember: false,
        isProviderUser: false,
      });
      mockOrgData.id = mockOrganizationId;
      mockOrgData.useAutomaticUserConfirmation = true;
      const permissions = new PermissionsApi();
      permissions.manageUsers = true;
      mockOrgData.permissions = permissions;
      const orgWhereNotMember = new Organization(mockOrgData);

      const organizations$ = new BehaviorSubject<Organization[]>([orgWhereNotMember]);
      organizationService.organizations$.mockReturnValue(organizations$);

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return false when policy does not apply to user", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(false));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(false);
    });

    it("should return true when policy applies to user", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      const canManage = await firstValueFrom(canManage$);

      expect(canManage).toBe(true);
    });

    it("should check policy with correct PolicyType and userId", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const canManage$ = service.canManageAutoConfirm$(mockUserId);
      await firstValueFrom(canManage$);

      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutoConfirm,
        mockUserId,
      );
    });

    it("should return false when policy does not apply to user and organization allows management", async () => {
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

    beforeEach(async () => {
      const organizations$ = new BehaviorSubject<Organization[]>([mockOrganization]);
      organizationService.organizations$.mockReturnValue(organizations$);
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      // Enable auto-confirm configuration for the user
      const enabledConfig = new AutoConfirmState();
      enabledConfig.enabled = true;
      await stateProvider.setUserState(
        AUTO_CONFIRM_STATE,
        { [mockUserId]: enabledConfig },
        mockUserId,
      );

      apiService.getUserPublicKey.mockResolvedValue({
        publicKey: mockPublicKey,
      } as UserKeyResponse);
      jest.spyOn(Utils, "fromB64ToArray").mockReturnValue(mockPublicKeyArray);
      organizationUserService.buildConfirmRequest.mockReturnValue(of(mockConfirmRequest));
      organizationUserApiService.postOrganizationUserAutoConfirm.mockResolvedValue(undefined);
    });

    it("should successfully auto-confirm a user with organizationId", async () => {
      await service.autoConfirmUser(
        mockUserId,
        mockConfirmingUserId,
        mockConfirmingOrganizationUserId,
        mockOrganizationId,
      );

      expect(apiService.getUserPublicKey).toHaveBeenCalledWith(mockConfirmingUserId);
      expect(organizationUserService.buildConfirmRequest).toHaveBeenCalledWith(
        mockOrganization,
        mockPublicKeyArray,
      );
      expect(organizationUserApiService.postOrganizationUserAutoConfirm).toHaveBeenCalledWith(
        mockOrganizationId,
        mockConfirmingOrganizationUserId,
        mockConfirmRequest,
      );
    });

    it("should return early when canManageAutoConfirm returns false", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(false));

      await service.autoConfirmUser(
        mockUserId,
        mockConfirmingUserId,
        mockConfirmingOrganizationUserId,
        mockOrganizationId,
      );

      expect(apiService.getUserPublicKey).not.toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAutoConfirm).not.toHaveBeenCalled();
    });

    it("should return early when auto-confirm is disabled in configuration", async () => {
      const disabledConfig = new AutoConfirmState();
      disabledConfig.enabled = false;
      await stateProvider.setUserState(
        AUTO_CONFIRM_STATE,
        { [mockUserId]: disabledConfig },
        mockUserId,
      );

      await service.autoConfirmUser(
        mockUserId,
        mockConfirmingUserId,
        mockConfirmingOrganizationUserId,
        mockOrganizationId,
      );

      expect(apiService.getUserPublicKey).not.toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAutoConfirm).not.toHaveBeenCalled();
    });

    it("should build confirm request with organization and public key", async () => {
      await service.autoConfirmUser(
        mockUserId,
        mockConfirmingUserId,
        mockConfirmingOrganizationUserId,
        mockOrganizationId,
      );

      expect(organizationUserService.buildConfirmRequest).toHaveBeenCalledWith(
        mockOrganization,
        mockPublicKeyArray,
      );
    });

    it("should call API with correct parameters", async () => {
      await service.autoConfirmUser(
        mockUserId,
        mockConfirmingUserId,
        mockConfirmingOrganizationUserId,
        mockOrganizationId,
      );

      expect(organizationUserApiService.postOrganizationUserAutoConfirm).toHaveBeenCalledWith(
        mockOrganizationId,
        mockConfirmingOrganizationUserId,
        mockConfirmRequest,
      );
    });

    it("should handle API errors gracefully", async () => {
      const apiError = new Error("API Error");
      apiService.getUserPublicKey.mockRejectedValue(apiError);

      await expect(
        service.autoConfirmUser(
          mockUserId,
          mockConfirmingUserId,
          mockConfirmingOrganizationUserId,
          mockOrganizationId,
        ),
      ).rejects.toThrow("API Error");

      expect(organizationUserApiService.postOrganizationUserAutoConfirm).not.toHaveBeenCalled();
    });

    it("should handle buildConfirmRequest errors gracefully", async () => {
      const buildError = new Error("Build Error");
      organizationUserService.buildConfirmRequest.mockReturnValue(throwError(() => buildError));

      await expect(
        service.autoConfirmUser(
          mockUserId,
          mockConfirmingUserId,
          mockConfirmingOrganizationUserId,
          mockOrganizationId,
        ),
      ).rejects.toThrow("Build Error");

      expect(organizationUserApiService.postOrganizationUserAutoConfirm).not.toHaveBeenCalled();
    });
  });

  describe("bulkAutoConfirmPendingUsers", () => {
    const mockPendingOrgUserId = newGuid() as UserId;
    const mockPendingUserId = newGuid() as UserId;
    const mockPublicKey = "mockPublicKeyBase64";
    let mockPublicKeyArray: Uint8Array<ArrayBuffer>;
    const mockConfirmRequest: OrganizationUserConfirmRequest = {
      key: "encryptedOrgKey" as any,
      defaultUserCollectionName: "encryptedCollectionName" as any,
    };

    beforeEach(() => {
      mockPublicKeyArray = new Uint8Array(new ArrayBuffer(4));
      jest.spyOn(Utils, "fromB64ToArray").mockReturnValue(mockPublicKeyArray);

      configService.getFeatureFlag.mockResolvedValue(true);

      const organizations$ = new BehaviorSubject<Organization[]>([mockOrganization]);
      organizationService.organizations$.mockReturnValue(organizations$);
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const pendingUser = { id: mockPendingOrgUserId, userId: mockPendingUserId } as any;
      const listResponse = {
        data: [pendingUser],
      } as ListResponse<OrganizationUserPendingAutoConfirmResponse>;
      organizationUserApiService.getPendingAutoConfirmUsers.mockResolvedValue(listResponse);

      organizationUserApiService.postOrganizationUsersPublicKey.mockResolvedValue({
        data: [{ id: mockPendingOrgUserId, userId: mockPendingUserId, key: mockPublicKey }],
      } as any);

      organizationUserService.buildConfirmRequest.mockReturnValue(of(mockConfirmRequest));
      organizationUserApiService.postBulkOrganizationUserAutoConfirm.mockResolvedValue({} as any);
    });

    const enableAutoConfirmState = async () => {
      const enabledConfig = new AutoConfirmState();
      enabledConfig.enabled = true;
      await stateProvider.setUserState(
        AUTO_CONFIRM_STATE,
        { [mockUserId]: enabledConfig },
        mockUserId,
      );
    };

    it("should return early when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.getPendingAutoConfirmUsers).not.toHaveBeenCalled();
    });

    it("should return early when canManageAutoConfirm returns false", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(false));

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.getPendingAutoConfirmUsers).not.toHaveBeenCalled();
    });

    it("should return early when auto-confirm is disabled in configuration", async () => {
      // State not set → enabled is false by default

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.getPendingAutoConfirmUsers).not.toHaveBeenCalled();
    });

    it("should return early when there are no pending users", async () => {
      await enableAutoConfirmState();
      organizationUserApiService.getPendingAutoConfirmUsers.mockResolvedValue({
        data: [],
      } as any);

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.postBulkOrganizationUserAutoConfirm).not.toHaveBeenCalled();
    });

    it("should fetch public keys and build bulk confirm request for each pending user", async () => {
      await enableAutoConfirmState();

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.postOrganizationUsersPublicKey).toHaveBeenCalledWith(
        mockOrganizationId,
        [mockPendingOrgUserId],
      );
      expect(organizationUserService.buildConfirmRequest).toHaveBeenCalledWith(
        mockOrganization,
        mockPublicKeyArray,
      );
    });

    it("should post bulk auto-confirm request with correct structure", async () => {
      await enableAutoConfirmState();

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.postBulkOrganizationUserAutoConfirm).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.any(OrganizationUserBulkConfirmRequest),
      );

      const calledWith = (
        organizationUserApiService.postBulkOrganizationUserAutoConfirm as jest.Mock
      ).mock.calls[0][1] as OrganizationUserBulkConfirmRequest;
      expect(calledWith.keys).toHaveLength(1);
      expect(calledWith.keys[0].id).toBe(mockPendingOrgUserId);
    });

    it("should handle multiple pending users", async () => {
      await enableAutoConfirmState();

      const secondOrgUserId = newGuid() as UserId;
      const secondUserId = newGuid() as UserId;
      const secondPendingUser = { id: secondOrgUserId, userId: secondUserId } as any;
      organizationUserApiService.getPendingAutoConfirmUsers.mockResolvedValue({
        data: [{ id: mockPendingOrgUserId, userId: mockPendingUserId } as any, secondPendingUser],
      } as any);
      organizationUserApiService.postOrganizationUsersPublicKey.mockResolvedValue({
        data: [
          { id: mockPendingOrgUserId, userId: mockPendingUserId, key: mockPublicKey },
          { id: secondOrgUserId, userId: secondUserId, key: mockPublicKey },
        ],
      } as any);

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.postOrganizationUsersPublicKey).toHaveBeenCalledWith(
        mockOrganizationId,
        [mockPendingOrgUserId, secondOrgUserId],
      );
      expect(organizationUserService.buildConfirmRequest).toHaveBeenCalledTimes(2);

      const calledWith = (
        organizationUserApiService.postBulkOrganizationUserAutoConfirm as jest.Mock
      ).mock.calls[0][1] as OrganizationUserBulkConfirmRequest;
      expect(calledWith.keys).toHaveLength(2);
    });

    it("should return early when no organization is found", async () => {
      await enableAutoConfirmState();
      organizationService.organizations$.mockReturnValue(of([]));

      await service.bulkAutoConfirmPendingUsers(mockUserId);

      expect(organizationUserApiService.getPendingAutoConfirmUsers).not.toHaveBeenCalled();
    });
  });

  describe("initBulkAutoConfirmOnLoginSweep", () => {
    let accountsSubject: BehaviorSubject<Record<UserId, AccountInfo>>;
    let authStatusSubject: BehaviorSubject<AuthenticationStatus>;

    const createSweepService = () =>
      new DefaultAutomaticUserConfirmationService(
        apiService,
        organizationUserService,
        stateProvider,
        organizationService,
        organizationUserApiService,
        policyService,
        authService,
        accountService,
        configService,
      );

    beforeEach(() => {
      accountsSubject = new BehaviorSubject({} as Record<UserId, AccountInfo>);
      accountService.accounts$ = accountsSubject;
      configService.getFeatureFlag.mockResolvedValue(true);
    });

    it("should not set up subscription when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);
      authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
      authService.authStatusFor$.mockReturnValue(authStatusSubject);

      const svc = createSweepService();
      const spy = jest
        .spyOn(svc as any, "bulkAutoConfirmPendingUsers")
        .mockResolvedValue(undefined);

      await Promise.resolve(); // flush feature flag check

      accountsSubject.next({ [mockUserId]: {} as AccountInfo });

      expect(spy).not.toHaveBeenCalled();
    });

    it("should trigger sweep when a user account appears already in the Unlocked state (fresh login)", async () => {
      authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
      authService.authStatusFor$.mockReturnValue(authStatusSubject);

      const svc = createSweepService();
      const spy = jest
        .spyOn(svc as any, "bulkAutoConfirmPendingUsers")
        .mockResolvedValue(undefined);

      await Promise.resolve(); // flush feature flag check so subscription is active

      // Account becomes visible in accounts$ for the first time while already Unlocked
      accountsSubject.next({ [mockUserId]: {} as AccountInfo });

      expect(spy).toHaveBeenCalledWith(mockUserId);
    });

    it("should trigger sweep when a user transitions from Locked to Unlocked", async () => {
      authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Locked);
      authService.authStatusFor$.mockReturnValue(authStatusSubject);

      const svc = createSweepService();
      const spy = jest
        .spyOn(svc as any, "bulkAutoConfirmPendingUsers")
        .mockResolvedValue(undefined);

      await Promise.resolve(); // flush feature flag check so subscription is active

      accountsSubject.next({ [mockUserId]: {} as AccountInfo });
      expect(spy).not.toHaveBeenCalled();

      authStatusSubject.next(AuthenticationStatus.Unlocked);

      expect(spy).toHaveBeenCalledWith(mockUserId);
    });

    it("should not trigger sweep when status stays Locked", async () => {
      authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Locked);
      authService.authStatusFor$.mockReturnValue(authStatusSubject);

      const svc = createSweepService();
      const spy = jest
        .spyOn(svc as any, "bulkAutoConfirmPendingUsers")
        .mockResolvedValue(undefined);

      await Promise.resolve(); // flush feature flag check so subscription is active

      accountsSubject.next({ [mockUserId]: {} as AccountInfo });

      expect(spy).not.toHaveBeenCalled();
    });

    it("should not re-trigger sweep when accounts$ emits again for the same already-Unlocked user (e.g. account info update)", async () => {
      authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
      authService.authStatusFor$.mockReturnValue(authStatusSubject);

      const svc = createSweepService();
      const spy = jest
        .spyOn(svc as any, "bulkAutoConfirmPendingUsers")
        .mockResolvedValue(undefined);

      await Promise.resolve(); // flush feature flag check so subscription is active

      // First emission: userId is new, subscription is set up, sweep fires once
      accountsSubject.next({ [mockUserId]: {} as AccountInfo });
      expect(spy).toHaveBeenCalledTimes(1);

      // Second emission: same userId, accounts$ emits again (e.g. account name/email change)
      accountsSubject.next({ [mockUserId]: {} as AccountInfo });

      // Must not have triggered a second sweep
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
