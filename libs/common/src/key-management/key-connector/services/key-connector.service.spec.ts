import { mock } from "jest-mock-extended";
import { firstValueFrom, of, timeout, TimeoutError } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfType, KeyService } from "@bitwarden/key-management";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { ApiService } from "../../../abstractions/api.service";
import { OrganizationData } from "../../../admin-console/models/data/organization.data";
import { Organization } from "../../../admin-console/models/domain/organization";
import { ProfileOrganizationResponse } from "../../../admin-console/models/response/profile-organization.response";
import { IdentityTokenResponse } from "../../../auth/models/response/identity-token.response";
import { KeyConnectorUserKeyResponse } from "../../../auth/models/response/key-connector-user-key.response";
import { TokenService } from "../../../auth/services/token.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { KeyGenerationService } from "../../crypto";
import { EncString } from "../../crypto/models/enc-string";
import { FakeMasterPasswordService } from "../../master-password/services/fake-master-password.service";
import { KeyConnectorUserKeyRequest } from "../models/key-connector-user-key.request";

import { USES_KEY_CONNECTOR, KeyConnectorService } from "./key-connector.service";

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

  const keyConnectorUrl = "https://key-connector-url.com";

  beforeEach(() => {
    jest.resetAllMocks();

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

  describe("setUsesKeyConnector", () => {
    it("should update the usesKeyConnectorState with the provided false value", async () => {
      const state = stateProvider.singleUser.getFake(mockUserId, USES_KEY_CONNECTOR);
      state.nextState(false);

      await keyConnectorService.setUsesKeyConnector(true, mockUserId);

      expect(await firstValueFrom(state.state$)).toBe(true);
    });

    it("should update the usesKeyConnectorState with the provided true value", async () => {
      const state = stateProvider.singleUser.getFake(mockUserId, USES_KEY_CONNECTOR);
      state.nextState(true);

      await keyConnectorService.setUsesKeyConnector(false, mockUserId);

      expect(await firstValueFrom(state.state$)).toBe(false);
    });
  });

  describe("getUsesKeyConnector", () => {
    it("should return false when uses key connector state is not set", async () => {
      const state = stateProvider.singleUser.getFake(mockUserId, USES_KEY_CONNECTOR);
      state.nextState(null);

      const usesKeyConnector = await keyConnectorService.getUsesKeyConnector(mockUserId);

      expect(usesKeyConnector).toEqual(false);
    });

    it("should return false when uses key connector state is set to false", async () => {
      stateProvider.getUserState$(USES_KEY_CONNECTOR, mockUserId);
      const state = stateProvider.singleUser.getFake(mockUserId, USES_KEY_CONNECTOR);
      state.nextState(false);

      const usesKeyConnector = await keyConnectorService.getUsesKeyConnector(mockUserId);

      expect(usesKeyConnector).toEqual(false);
    });

    it("should return true when uses key connector state is set to true", async () => {
      const state = stateProvider.singleUser.getFake(mockUserId, USES_KEY_CONNECTOR);
      state.nextState(true);

      const usesKeyConnector = await keyConnectorService.getUsesKeyConnector(mockUserId);

      expect(usesKeyConnector).toEqual(true);
    });
  });

  describe("getManagingOrganization", () => {
    it("should return the managing organization with key connector enabled", async () => {
      // Arrange
      const orgs = [
        organizationData(true, true, keyConnectorUrl, OrganizationUserType.User, false),
        organizationData(false, true, keyConnectorUrl, OrganizationUserType.User, false),
        organizationData(true, false, keyConnectorUrl, OrganizationUserType.User, false),
        organizationData(true, true, "https://other-url.com", OrganizationUserType.User, false),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization(mockUserId);

      // Assert
      expect(result).toEqual(orgs[0]);
    });

    it("should return undefined if no managing organization with key connector enabled is found", async () => {
      // Arrange
      const orgs = [
        organizationData(true, false, keyConnectorUrl, OrganizationUserType.User, false),
        organizationData(false, false, keyConnectorUrl, OrganizationUserType.User, false),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization(mockUserId);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined if user is Owner or Admin", async () => {
      // Arrange
      const orgs = [
        organizationData(true, true, keyConnectorUrl, 0, false),
        organizationData(true, true, keyConnectorUrl, 1, false),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization(mockUserId);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined if user is a Provider", async () => {
      // Arrange
      const orgs = [
        organizationData(true, true, keyConnectorUrl, OrganizationUserType.User, true),
        organizationData(false, true, keyConnectorUrl, OrganizationUserType.User, true),
      ];
      organizationService.organizations$.mockReturnValue(of(orgs));

      // Act
      const result = await keyConnectorService.getManagingOrganization(mockUserId);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("setMasterKeyFromUrl", () => {
    it("should set the master key from the provided URL", async () => {
      // Arrange
      const url = keyConnectorUrl;

      apiService.getMasterKeyFromKeyConnector.mockResolvedValue(mockMasterKeyResponse);

      // Hard to mock these, but we can generate the same keys
      const keyArr = Utils.fromB64ToArray(mockMasterKeyResponse.key);
      const masterKey = new SymmetricCryptoKey(keyArr) as MasterKey;

      // Act
      await keyConnectorService.setMasterKeyFromUrl(url, mockUserId);

      // Assert
      expect(apiService.getMasterKeyFromKeyConnector).toHaveBeenCalledWith(url);
      expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(masterKey, mockUserId);
    });

    it("should handle errors thrown during the process", async () => {
      // Arrange
      const url = keyConnectorUrl;

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

  describe("migrateUser", () => {
    it("should migrate the user to the key connector", async () => {
      // Arrange
      const masterKey = getMockMasterKey();
      masterPasswordService.masterKeySubject.next(masterKey);
      const keyConnectorRequest = new KeyConnectorUserKeyRequest(
        Utils.fromBufferToB64(masterKey.inner().encryptionKey),
      );

      jest.spyOn(apiService, "postUserKeyToKeyConnector").mockResolvedValue();

      // Act
      await keyConnectorService.migrateUser(keyConnectorUrl, mockUserId);

      // Assert
      expect(apiService.postUserKeyToKeyConnector).toHaveBeenCalledWith(
        keyConnectorUrl,
        keyConnectorRequest,
      );
      expect(apiService.postConvertToKeyConnector).toHaveBeenCalled();
    });

    it("should handle errors thrown during migration", async () => {
      // Arrange
      const masterKey = getMockMasterKey();
      const keyConnectorRequest = new KeyConnectorUserKeyRequest(
        Utils.fromBufferToB64(masterKey.inner().encryptionKey),
      );
      masterPasswordService.masterKeySubject.next(masterKey);
      const error = new Error("Failed to post user key to key connector");
      jest.spyOn(apiService, "postUserKeyToKeyConnector").mockRejectedValue(error);
      jest.spyOn(logService, "error");

      try {
        // Act
        await keyConnectorService.migrateUser(keyConnectorUrl, mockUserId);
      } catch {
        // Assert
        expect(logService.error).toHaveBeenCalledWith(error);
        expect(apiService.postUserKeyToKeyConnector).toHaveBeenCalledWith(
          keyConnectorUrl,
          keyConnectorRequest,
        );
      }
    });
  });

  describe("convertAccountRequired$", () => {
    beforeEach(async () => {
      const organization = organizationData(
        true,
        true,
        keyConnectorUrl,
        OrganizationUserType.User,
        false,
      );
      organizationService.organizations$.mockReturnValue(of([organization]));
      await stateProvider.getUser(mockUserId, USES_KEY_CONNECTOR).update(() => false);
      tokenService.getIsExternal.mockResolvedValue(true);
      tokenService.hasAccessToken$.mockReturnValue(of(true));
    });

    it("should return true when user logged in with sso, belong to organization using key connector and user does not use key connector", async () => {
      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(true);
    });

    it("should return false when user logged in with password", async () => {
      tokenService.getIsExternal.mockResolvedValue(false);

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(false);
    });

    it("should return false when organization's key connector disabled", async () => {
      const organization = organizationData(
        true,
        false,
        keyConnectorUrl,
        OrganizationUserType.User,
        false,
      );
      organizationService.organizations$.mockReturnValue(of([organization]));

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(false);
    });

    it("should return false when user is admin of the organization", async () => {
      const organization = organizationData(
        true,
        true,
        keyConnectorUrl,
        OrganizationUserType.Admin,
        false,
      );
      organizationService.organizations$.mockReturnValue(of([organization]));

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(false);
    });

    it("should return false when user is owner of the organization", async () => {
      const organization = organizationData(
        true,
        true,
        keyConnectorUrl,
        OrganizationUserType.Owner,
        false,
      );
      organizationService.organizations$.mockReturnValue(of([organization]));

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(false);
    });

    it("should return false when user is provider user of the organization", async () => {
      const organization = organizationData(
        true,
        true,
        keyConnectorUrl,
        OrganizationUserType.User,
        true,
      );
      organizationService.organizations$.mockReturnValue(of([organization]));

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(false);
    });

    it("should return false when user already uses key connector", async () => {
      await stateProvider.getUser(mockUserId, USES_KEY_CONNECTOR).update(() => true);

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).resolves.toEqual(false);
    });

    it("should not return any value when user not logged in", async () => {
      await accountService.switchAccount(null as unknown as UserId);

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should not return any value when organization state is empty", async () => {
      organizationService.organizations$.mockReturnValue(of(null as unknown as Organization[]));

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should not return any value when user is not using key connector", async () => {
      await stateProvider.getUser(mockUserId, USES_KEY_CONNECTOR).update(() => null);

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should not return any value when user does not have access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      await expect(
        firstValueFrom(keyConnectorService.convertAccountRequired$.pipe(timeout(100))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });
  });

  describe("convertNewSsoUserToKeyConnector", () => {
    const tokenResponse = mock<IdentityTokenResponse>();
    const passwordKey = new SymmetricCryptoKey(new Uint8Array(64));
    const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    const mockEmail = "test@example.com";
    const mockMasterKey = getMockMasterKey();
    let mockMakeUserKeyResult: [UserKey, EncString];

    beforeEach(() => {
      const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const mockKeyPair = ["mockPubKey", new EncString("mockEncryptedPrivKey")] as [
        string,
        EncString,
      ];
      const encString = new EncString("mockEncryptedString");
      mockMakeUserKeyResult = [mockUserKey, encString] as [UserKey, EncString];

      tokenResponse.kdf = KdfType.PBKDF2_SHA256;
      tokenResponse.kdfIterations = 100000;
      tokenResponse.kdfMemory = 16;
      tokenResponse.kdfParallelism = 4;
      tokenResponse.keyConnectorUrl = keyConnectorUrl;

      keyGenerationService.createKey.mockResolvedValue(passwordKey);
      keyService.makeMasterKey.mockResolvedValue(mockMasterKey);
      keyService.makeUserKey.mockResolvedValue(mockMakeUserKeyResult);
      keyService.makeKeyPair.mockResolvedValue(mockKeyPair);
      tokenService.getEmail.mockResolvedValue(mockEmail);
    });

    it("sets up a new SSO user with key connector", async () => {
      await keyConnectorService.convertNewSsoUserToKeyConnector(
        tokenResponse,
        mockOrgId,
        mockUserId,
      );

      expect(keyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        passwordKey.keyB64,
        mockEmail,
        expect.any(Object),
      );
      expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        mockUserId,
      );
      expect(keyService.makeUserKey).toHaveBeenCalledWith(mockMasterKey);
      expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, mockUserId);
      expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        mockMakeUserKeyResult[1],
        mockUserId,
      );
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(mockMakeUserKeyResult[0]);
      expect(apiService.postUserKeyToKeyConnector).toHaveBeenCalledWith(
        tokenResponse.keyConnectorUrl,
        expect.any(KeyConnectorUserKeyRequest),
      );
      expect(apiService.postSetKeyConnectorKey).toHaveBeenCalled();
    });

    it("handles api error", async () => {
      apiService.postUserKeyToKeyConnector.mockRejectedValue(new Error("API error"));

      try {
        await keyConnectorService.convertNewSsoUserToKeyConnector(
          tokenResponse,
          mockOrgId,
          mockUserId,
        );
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe("Key Connector error");
      }

      expect(keyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        passwordKey.keyB64,
        mockEmail,
        expect.any(Object),
      );
      expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        mockUserId,
      );
      expect(keyService.makeUserKey).toHaveBeenCalledWith(mockMasterKey);
      expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, mockUserId);
      expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        mockMakeUserKeyResult[1],
        mockUserId,
      );
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(mockMakeUserKeyResult[0]);
      expect(apiService.postUserKeyToKeyConnector).toHaveBeenCalledWith(
        tokenResponse.keyConnectorUrl,
        expect.any(KeyConnectorUserKeyRequest),
      );
      expect(apiService.postSetKeyConnectorKey).not.toHaveBeenCalled();
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
          useOrganizationDomains: true,
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
