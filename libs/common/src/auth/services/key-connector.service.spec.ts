import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { OrganizationData } from "../../admin-console/models/data/organization.data";
import { Organization } from "../../admin-console/models/domain/organization";
import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { LogService } from "../../platform/abstractions/log.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { KeyGenerationService } from "../../platform/services/key-generation.service";
import { OrganizationId, UserId } from "../../types/guid";
import { MasterKey } from "../../types/key";
import { KeyConnectorUserKeyRequest } from "../models/request/key-connector-user-key.request";
import { KeyConnectorUserKeyResponse } from "../models/response/key-connector-user-key.response";

import {
  USES_KEY_CONNECTOR,
  CONVERT_ACCOUNT_TO_KEY_CONNECTOR,
  KeyConnectorService,
} from "./key-connector.service";
import { FakeMasterPasswordService } from "./master-password/fake-master-password.service";
import { TokenService } from "./token.service";

describe("KeyConnectorService", () => {
  let keyConnectorService: KeyConnectorService;

  const keyService = mock<KeyService>();
  const apiService = mock<ApiService>();
  const tokenService = mock<TokenService>();
  const logService = mock<LogService>();
  const organizationService = mock<OrganizationService>();
  const keyGenerationService = mock<KeyGenerationService>();

  let stateProvider: FakeStateProvider;

  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  const mockUserId = Utils.newGuid() as UserId;
  const mockOrgId = Utils.newGuid() as OrganizationId;

  const mockMasterKeyResponse: KeyConnectorUserKeyResponse = new KeyConnectorUserKeyResponse({
    key: "eO9nVlVl3I3sU6O+CyK0kEkpGtl/auT84Hig2WTXmZtDTqYtKpDvUPfjhgMOHf+KQzx++TVS2AOLYq856Caa7w==",
  });

  beforeEach(() => {
    jest.clearAllMocks();

    masterPasswordService = new FakeMasterPasswordService();
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    keyConnectorService = new KeyConnectorService(
      accountService,
      masterPasswordService,
      keyService,
      apiService,
      tokenService,
      logService,
      organizationService,
      keyGenerationService,
      async () => {},
      stateProvider,
    );
  });

  it("instantiates", () => {
    expect(keyConnectorService).not.toBeFalsy();
  });

  describe("setUsesKeyConnector()", () => {
    it("should update the usesKeyConnectorState with the provided value", async () => {
      const state = stateProvider.activeUser.getFake(USES_KEY_CONNECTOR);
      state.nextState(false);

      const newValue = true;

      await keyConnectorService.setUsesKeyConnector(newValue, mockUserId);

      expect(await keyConnectorService.getUsesKeyConnector(mockUserId)).toBe(newValue);
    });
  });

  describe("getManagingOrganization()", () => {
    it("should return the managing organization with key connector enabled", async () => {
      // Arrange
      const orgs = [
        organizationData(true, true, "https://key-connector-url.com", 2, false),
        organizationData(false, true, "https://key-connector-url.com", 2, false),
        organizationData(true, false, "https://key-connector-url.com", 2, false),
        organizationData(true, true, "https://other-url.com", 2, false),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization();

      // Assert
      expect(result).toEqual(orgs[0]);
    });

    it("should return undefined if no managing organization with key connector enabled is found", async () => {
      // Arrange
      const orgs = [
        organizationData(true, false, "https://key-connector-url.com", 2, false),
        organizationData(false, false, "https://key-connector-url.com", 2, false),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization();

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined if user is Owner or Admin", async () => {
      // Arrange
      const orgs = [
        organizationData(true, true, "https://key-connector-url.com", 0, false),
        organizationData(true, true, "https://key-connector-url.com", 1, false),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization();

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined if user is a Provider", async () => {
      // Arrange
      const orgs = [
        organizationData(true, true, "https://key-connector-url.com", 2, true),
        organizationData(false, true, "https://key-connector-url.com", 2, true),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization();

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("setConvertAccountRequired()", () => {
    it("should update the convertAccountToKeyConnectorState with the provided value", async () => {
      const state = stateProvider.activeUser.getFake(CONVERT_ACCOUNT_TO_KEY_CONNECTOR);
      state.nextState(false);

      const newValue = true;

      await keyConnectorService.setConvertAccountRequired(newValue);

      expect(await keyConnectorService.getConvertAccountRequired()).toBe(newValue);
    });

    it("should remove the convertAccountToKeyConnectorState", async () => {
      const state = stateProvider.activeUser.getFake(CONVERT_ACCOUNT_TO_KEY_CONNECTOR);
      state.nextState(false);

      const newValue: boolean = null;

      await keyConnectorService.setConvertAccountRequired(newValue);

      expect(await keyConnectorService.getConvertAccountRequired()).toBe(newValue);
    });
  });

  describe("userNeedsMigration()", () => {
    it("should return true if the user needs migration", async () => {
      // token
      tokenService.getIsExternal.mockResolvedValue(true);

      // create organization object
      const data = organizationData(true, true, "https://key-connector-url.com", 2, false);
      organizationService.organizations$.mockReturnValue(of([data]));

      // uses KeyConnector
      const state = stateProvider.activeUser.getFake(USES_KEY_CONNECTOR);
      state.nextState(false);

      const result = await keyConnectorService.userNeedsMigration(mockUserId);

      expect(result).toBe(true);
    });

    it("should return false if the user does not need migration", async () => {
      tokenService.getIsExternal.mockResolvedValue(false);
      const data = organizationData(false, false, "https://key-connector-url.com", 2, false);
      organizationService.organizations$.mockReturnValue(of([data]));

      const state = stateProvider.activeUser.getFake(USES_KEY_CONNECTOR);
      state.nextState(true);
      const result = await keyConnectorService.userNeedsMigration(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe("setMasterKeyFromUrl", () => {
    it("should set the master key from the provided URL", async () => {
      // Arrange
      const url = "https://key-connector-url.com";

      apiService.getMasterKeyFromKeyConnector.mockResolvedValue(mockMasterKeyResponse);

      // Hard to mock these, but we can generate the same keys
      const keyArr = Utils.fromB64ToArray(mockMasterKeyResponse.key);
      const masterKey = new SymmetricCryptoKey(keyArr) as MasterKey;

      // Act
      await keyConnectorService.setMasterKeyFromUrl(url, mockUserId);

      // Assert
      expect(apiService.getMasterKeyFromKeyConnector).toHaveBeenCalledWith(url);
      expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(
        masterKey,
        expect.any(String),
      );
    });

    it("should handle errors thrown during the process", async () => {
      // Arrange
      const url = "https://key-connector-url.com";

      const error = new Error("Failed to get master key");
      apiService.getMasterKeyFromKeyConnector.mockRejectedValue(error);
      jest.spyOn(logService, "error");

      try {
        // Act
        await keyConnectorService.setMasterKeyFromUrl(url, mockUserId);
      } catch {
        // Assert
        expect(logService.error).toHaveBeenCalledWith(error);
        expect(apiService.getMasterKeyFromKeyConnector).toHaveBeenCalledWith(url);
      }
    });
  });

  describe("migrateUser()", () => {
    it("should migrate the user to the key connector", async () => {
      // Arrange
      const organization = organizationData(true, true, "https://key-connector-url.com", 2, false);
      const masterKey = getMockMasterKey();
      masterPasswordService.masterKeySubject.next(masterKey);
      const keyConnectorRequest = new KeyConnectorUserKeyRequest(masterKey.encKeyB64);

      jest.spyOn(keyConnectorService, "getManagingOrganization").mockResolvedValue(organization);
      jest.spyOn(apiService, "postUserKeyToKeyConnector").mockResolvedValue();

      // Act
      await keyConnectorService.migrateUser();

      // Assert
      expect(keyConnectorService.getManagingOrganization).toHaveBeenCalled();
      expect(apiService.postUserKeyToKeyConnector).toHaveBeenCalledWith(
        organization.keyConnectorUrl,
        keyConnectorRequest,
      );
      expect(apiService.postConvertToKeyConnector).toHaveBeenCalled();
    });

    it("should handle errors thrown during migration", async () => {
      // Arrange
      const organization = organizationData(true, true, "https://key-connector-url.com", 2, false);
      const masterKey = getMockMasterKey();
      const keyConnectorRequest = new KeyConnectorUserKeyRequest(masterKey.encKeyB64);
      const error = new Error("Failed to post user key to key connector");
      organizationService.organizations$.mockReturnValue(of([organization]));

      masterPasswordService.masterKeySubject.next(masterKey);
      jest.spyOn(keyConnectorService, "getManagingOrganization").mockResolvedValue(organization);
      jest.spyOn(apiService, "postUserKeyToKeyConnector").mockRejectedValue(error);
      jest.spyOn(logService, "error");

      try {
        // Act
        await keyConnectorService.migrateUser();
      } catch {
        // Assert
        expect(logService.error).toHaveBeenCalledWith(error);
        expect(keyConnectorService.getManagingOrganization).toHaveBeenCalled();
        expect(apiService.postUserKeyToKeyConnector).toHaveBeenCalledWith(
          organization.keyConnectorUrl,
          keyConnectorRequest,
        );
      }
    });
  });

  function organizationData(
    usesKeyConnector: boolean,
    keyConnectorEnabled: boolean,
    keyConnectorUrl: string,
    userType: number,
    isProviderUser: boolean,
  ): Organization {
    return new Organization(
      new OrganizationData(
        new ProfileOrganizationResponse({
          id: mockOrgId,
          name: "TEST_KEY_CONNECTOR_ORG",
          usePolicies: true,
          useSso: true,
          useKeyConnector: usesKeyConnector,
          useScim: true,
          useGroups: true,
          useDirectory: true,
          useEvents: true,
          useTotp: true,
          use2fa: true,
          useApi: true,
          useResetPassword: true,
          useSecretsManager: true,
          usePasswordManager: true,
          usersGetPremium: true,
          useCustomPermissions: true,
          useActivateAutofillPolicy: true,
          selfHost: true,
          seats: 5,
          maxCollections: null,
          maxStorageGb: 1,
          key: "super-secret-key",
          status: 2,
          type: userType,
          enabled: true,
          ssoBound: true,
          identifier: "TEST_KEY_CONNECTOR_ORG",
          permissions: {
            accessEventLogs: false,
            accessImportExport: false,
            accessReports: false,
            createNewCollections: false,
            editAnyCollection: false,
            deleteAnyCollection: false,
            manageGroups: false,
            managePolicies: false,
            manageSso: false,
            manageUsers: false,
            manageResetPassword: false,
            manageScim: false,
          },
          resetPasswordEnrolled: true,
          userId: mockUserId,
          hasPublicAndPrivateKeys: true,
          providerId: null,
          providerName: null,
          providerType: null,
          familySponsorshipFriendlyName: null,
          familySponsorshipAvailable: true,
          planProductType: 3,
          KeyConnectorEnabled: keyConnectorEnabled,
          KeyConnectorUrl: keyConnectorUrl,
          familySponsorshipLastSyncDate: null,
          familySponsorshipValidUntil: null,
          familySponsorshipToDelete: null,
          accessSecretsManager: false,
          limitCollectionCreation: true,
          limitCollectionDeletion: true,
          limitItemDeletion: true,
          allowAdminAccessToAllCollectionItems: true,
          flexibleCollections: false,
          object: "profileOrganization",
        }),
        { isMember: true, isProviderUser: isProviderUser },
      ),
    );
  }

  function getMockMasterKey(): MasterKey {
    const keyArr = Utils.fromB64ToArray(mockMasterKeyResponse.key);
    const masterKey = new SymmetricCryptoKey(keyArr) as MasterKey;
    return masterKey;
  }
});
