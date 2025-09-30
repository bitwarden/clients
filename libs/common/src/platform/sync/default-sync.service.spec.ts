import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  LogoutReason,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SecurityStateService } from "@bitwarden/common/key-management/security-state/abstractions/security-state.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { Matrix } from "../../../spec/matrix";
import { ApiService } from "../../abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "../../admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "../../admin-console/abstractions/provider.service";
import { Account, AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AvatarService } from "../../auth/abstractions/avatar.service";
import { TokenService } from "../../auth/abstractions/token.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "../../billing/abstractions";
import { KeyConnectorService } from "../../key-management/key-connector/abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "../../key-management/master-password/abstractions/master-password.service.abstraction";
import { SendApiService } from "../../tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "../../tools/send/services/send.service.abstraction";
import { UserId } from "../../types/guid";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../vault/abstractions/folder/folder.service.abstraction";
import { LogService } from "../abstractions/log.service";
import { MessageSender } from "../messaging";
import { StateProvider } from "../state";

import { DefaultSyncService } from "./default-sync.service";
import { SyncResponse } from "./sync.response";

describe("DefaultSyncService", () => {
  let masterPasswordAbstraction: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let accountService: MockProxy<AccountService>;
  let apiService: MockProxy<ApiService>;
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let folderService: MockProxy<InternalFolderService>;
  let cipherService: MockProxy<CipherService>;
  let keyService: MockProxy<KeyService>;
  let collectionService: MockProxy<CollectionService>;
  let messageSender: MockProxy<MessageSender>;
  let policyService: MockProxy<InternalPolicyService>;
  let sendService: MockProxy<InternalSendService>;
  let logService: MockProxy<LogService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let providerService: MockProxy<ProviderService>;
  let folderApiService: MockProxy<FolderApiServiceAbstraction>;
  let organizationService: MockProxy<InternalOrganizationServiceAbstraction>;
  let sendApiService: MockProxy<SendApiService>;
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let avatarService: MockProxy<AvatarService>;
  let logoutCallback: jest.Mock<Promise<void>, [logoutReason: LogoutReason, userId?: UserId]>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let tokenService: MockProxy<TokenService>;
  let authService: MockProxy<AuthService>;
  let stateProvider: MockProxy<StateProvider>;
  let securityStateService: MockProxy<SecurityStateService>;

  let sut: DefaultSyncService;

  beforeEach(() => {
    masterPasswordAbstraction = mock();
    accountService = mock();
    apiService = mock();
    domainSettingsService = mock();
    folderService = mock();
    cipherService = mock();
    keyService = mock();
    collectionService = mock();
    messageSender = mock();
    policyService = mock();
    sendService = mock();
    logService = mock();
    keyConnectorService = mock();
    providerService = mock();
    folderApiService = mock();
    organizationService = mock();
    sendApiService = mock();
    userDecryptionOptionsService = mock();
    avatarService = mock();
    logoutCallback = jest.fn();
    billingAccountProfileStateService = mock();
    tokenService = mock();
    authService = mock();
    stateProvider = mock();
    securityStateService = mock();

    sut = new DefaultSyncService(
      masterPasswordAbstraction,
      accountService,
      apiService,
      domainSettingsService,
      folderService,
      cipherService,
      keyService,
      collectionService,
      messageSender,
      policyService,
      sendService,
      logService,
      keyConnectorService,
      providerService,
      folderApiService,
      organizationService,
      sendApiService,
      userDecryptionOptionsService,
      avatarService,
      logoutCallback,
      billingAccountProfileStateService,
      tokenService,
      authService,
      stateProvider,
      securityStateService,
    );
  });

  const user1 = "user1" as UserId;

  const emptySyncResponse = new SyncResponse({
    profile: {
      id: user1,
    },
    folders: [],
    collections: [],
    ciphers: [],
    sends: [],
    domains: [],
    policies: [],
  });

  describe("fullSync", () => {
    beforeEach(() => {
      accountService.activeAccount$ = of({ id: user1 } as Account);
      Matrix.autoMockMethod(authService.authStatusFor$, () => of(AuthenticationStatus.Unlocked));
      apiService.getSync.mockResolvedValue(emptySyncResponse);
      Matrix.autoMockMethod(userDecryptionOptionsService.userDecryptionOptionsById$, () =>
        of({ hasMasterPassword: true } satisfies UserDecryptionOptions),
      );
      stateProvider.getUser.mockReturnValue(mock());
    });

    it("sets the correct keys for a V1 user with old response model", async () => {
      const v1Profile = {
        id: user1,
        key: "encryptedUserKey",
        privateKey: "privateKey",
        providers: [] as any[],
        organizations: [] as any[],
        providerOrganizations: [] as any[],
        avatarColor: "#fff",
        securityStamp: "stamp",
        emailVerified: true,
        verifyDevices: false,
        premiumPersonally: false,
        premiumFromOrganization: false,
        usesKeyConnector: false,
      };
      apiService.getSync.mockResolvedValue(
        new SyncResponse({
          profile: v1Profile,
          folders: [],
          collections: [],
          ciphers: [],
          sends: [],
          domains: [],
          policies: [],
        }),
      );
      await sut.fullSync(true);
      expect(masterPasswordAbstraction.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString("encryptedUserKey"),
        user1,
      );
      expect(keyService.setPrivateKey).toHaveBeenCalledWith("privateKey", user1);
      expect(keyService.setProviderKeys).toHaveBeenCalledWith([], user1);
      expect(keyService.setOrgKeys).toHaveBeenCalledWith([], [], user1);
    });

    it("sets the correct keys for a V1 user", async () => {
      const v1Profile = {
        id: user1,
        key: "encryptedUserKey",
        privateKey: "privateKey",
        providers: [] as any[],
        organizations: [] as any[],
        providerOrganizations: [] as any[],
        avatarColor: "#fff",
        securityStamp: "stamp",
        emailVerified: true,
        verifyDevices: false,
        premiumPersonally: false,
        premiumFromOrganization: false,
        usesKeyConnector: false,
        accountKeys: {
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: "wrappedPrivateKey",
            publicKey: "publicKey",
          },
        },
      };
      apiService.getSync.mockResolvedValue(
        new SyncResponse({
          profile: v1Profile,
          folders: [],
          collections: [],
          ciphers: [],
          sends: [],
          domains: [],
          policies: [],
        }),
      );
      await sut.fullSync(true);
      expect(masterPasswordAbstraction.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString("encryptedUserKey"),
        user1,
      );
      expect(keyService.setPrivateKey).toHaveBeenCalledWith("wrappedPrivateKey", user1);
      expect(keyService.setProviderKeys).toHaveBeenCalledWith([], user1);
      expect(keyService.setOrgKeys).toHaveBeenCalledWith([], [], user1);
    });

    it("sets the correct keys for a V2 user", async () => {
      const v2Profile = {
        id: user1,
        key: "encryptedUserKey",
        providers: [] as unknown[],
        organizations: [] as unknown[],
        providerOrganizations: [] as unknown[],
        avatarColor: "#fff",
        securityStamp: "stamp",
        emailVerified: true,
        verifyDevices: false,
        premiumPersonally: false,
        premiumFromOrganization: false,
        usesKeyConnector: false,
        privateKey: "wrappedPrivateKey",
        accountKeys: {
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: "wrappedPrivateKey",
            publicKey: "publicKey",
            signedPublicKey: "signedPublicKey",
          },
          signatureKeyPair: {
            wrappedSigningKey: "wrappedSigningKey",
            verifyingKey: "verifyingKey",
          },
          securityState: {
            securityState: "securityState",
          },
        },
      };
      apiService.getSync.mockResolvedValue(
        new SyncResponse({
          profile: v2Profile,
          folders: [],
          collections: [],
          ciphers: [],
          sends: [],
          domains: [],
          policies: [],
        }),
      );
      await sut.fullSync(true);
      expect(masterPasswordAbstraction.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString("encryptedUserKey"),
        user1,
      );
      expect(keyService.setPrivateKey).toHaveBeenCalledWith("wrappedPrivateKey", user1);
      expect(keyService.setUserSigningKey).toHaveBeenCalledWith("wrappedSigningKey", user1);
      expect(securityStateService.setAccountSecurityState).toHaveBeenCalledWith(
        "securityState",
        user1,
      );
      expect(keyService.setProviderKeys).toHaveBeenCalledWith([], user1);
      expect(keyService.setOrgKeys).toHaveBeenCalledWith([], [], user1);
    });

    it("does a token refresh when option missing from options", async () => {
      await sut.fullSync(true, { allowThrowOnError: false });

      expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    it("does a token refresh when boolean passed in", async () => {
      await sut.fullSync(true, false);

      expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    it("does a token refresh when skipTokenRefresh option passed in with false and allowThrowOnError also passed in", async () => {
      await sut.fullSync(true, { allowThrowOnError: false, skipTokenRefresh: false });

      expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    it("does a token refresh when skipTokenRefresh option passed in with false by itself", async () => {
      await sut.fullSync(true, { skipTokenRefresh: false });

      expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    it("does not do a token refresh when skipTokenRefresh passed in as true", async () => {
      await sut.fullSync(true, { skipTokenRefresh: true });

      expect(apiService.refreshIdentityToken).not.toHaveBeenCalled();
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    it("does not do a token refresh when skipTokenRefresh passed in as true and allowThrowOnError also passed in", async () => {
      await sut.fullSync(true, { allowThrowOnError: false, skipTokenRefresh: true });

      expect(apiService.refreshIdentityToken).not.toHaveBeenCalled();
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    it("does a token refresh when nothing passed in", async () => {
      await sut.fullSync(true);

      expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
      expect(apiService.getSync).toHaveBeenCalledTimes(1);
    });

    describe("in-flight syncs", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("does not call getSync when one is already in progress", async () => {
        const fullSyncPromises = [sut.fullSync(true), sut.fullSync(false), sut.fullSync(false)];

        jest.advanceTimersByTime(100);

        await Promise.all(fullSyncPromises);

        expect(apiService.getSync).toHaveBeenCalledTimes(1);
      });

      it("does not call refreshIdentityToken when one is already in progress", async () => {
        const fullSyncPromises = [sut.fullSync(true), sut.fullSync(false), sut.fullSync(false)];

        jest.advanceTimersByTime(100);

        await Promise.all(fullSyncPromises);

        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
      });

      it("resets the in-flight properties when the complete", async () => {
        const fullSyncPromises = [sut.fullSync(true), sut.fullSync(true)];

        await Promise.all(fullSyncPromises);

        expect(sut["inFlightApiCalls"].refreshToken).toBeNull();
        expect(sut["inFlightApiCalls"].sync).toBeNull();
      });
    });
  });
});
