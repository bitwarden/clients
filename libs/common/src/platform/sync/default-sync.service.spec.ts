import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, of, Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  LogoutReason,
  UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { Measurement } from "@bitwarden/logging";
import { CryptoSyncData } from "@bitwarden/sdk-internal";

import { Matrix } from "../../../spec/matrix";
import { ApiService } from "../../abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "../../admin-console/abstractions/organization/organization.service.abstraction";
import { InternalNewPolicyService } from "../../admin-console/abstractions/policy/new-policy.service";
import { InternalPolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "../../admin-console/abstractions/provider.service";
import { OrganizationUserStatusType } from "../../admin-console/enums";
import { Account, AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AvatarService } from "../../auth/abstractions/avatar.service";
import { TokenService } from "../../auth/abstractions/token.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "../../billing/abstractions";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { KeyConnectorService } from "../../key-management/key-connector/abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "../../key-management/master-password/abstractions/master-password.service.abstraction";
import { SyncSendNotification } from "../../models/response/notification.response";
import { SendData } from "../../tools/send/models/data/send.data";
import { SendApiService } from "../../tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "../../tools/send/services/send.service.abstraction";
import { SendType } from "../../tools/send/types/send-type";
import { UserId } from "../../types/guid";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../vault/abstractions/folder/folder.service.abstraction";
import { ConfigService } from "../abstractions/config/config.service";
import { LogService } from "../abstractions/log.service";
import { SdkService } from "../abstractions/sdk/sdk.service";
import { MessageSender } from "../messaging";
import { Utils } from "../misc/utils";
import { SingleUserState, StateProvider } from "../state";

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
  let newPolicyService: MockProxy<InternalNewPolicyService>;
  let sendService: MockProxy<InternalSendService>;
  let logService: MockProxy<LogService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let providerService: MockProxy<ProviderService>;
  let folderApiService: MockProxy<FolderApiServiceAbstraction>;
  let organizationService: MockProxy<InternalOrganizationServiceAbstraction>;
  let sendApiService: MockProxy<SendApiService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let avatarService: MockProxy<AvatarService>;
  let logoutCallback: jest.Mock<Promise<void>, [logoutReason: LogoutReason, userId?: UserId]>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let tokenService: MockProxy<TokenService>;
  let authService: MockProxy<AuthService>;
  let stateProvider: MockProxy<StateProvider>;
  let configService: MockProxy<ConfigService>;
  let sdkService: MockProxy<SdkService>;
  let cryptoSyncHandler: { on_sync: jest.Mock<Promise<void>, [CryptoSyncData]> };
  let sendsClient: { fetch: jest.Mock; retry_pending_deletions: jest.Mock };

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
    newPolicyService = mock();
    sendService = mock();
    logService = mock<LogService>({ startMeasurement: () => mock<Measurement>() });
    keyConnectorService = mock();
    keyConnectorService.convertAccountRequired$ = of(false);
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
    configService = mock();
    sdkService = mock();
    cryptoSyncHandler = { on_sync: jest.fn().mockResolvedValue(undefined) };
    sendsClient = {
      fetch: jest.fn(),
      retry_pending_deletions: jest.fn().mockResolvedValue(undefined),
    };
    sdkService.userClient$.mockReturnValue(
      of({
        take: () => ({
          value: {
            crypto_sync_handler: () => cryptoSyncHandler,
            sends: () => sendsClient,
          },
          [Symbol.dispose]: jest.fn(),
        }),
      }) as unknown as ReturnType<typeof sdkService.userClient$>,
    );

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
      newPolicyService,
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
      configService,
      sdkService,
    );
  });

  const user1 = "user1" as UserId;

  const emptySyncResponse = new SyncResponse({
    profile: {
      id: user1,
      accountKeys: {
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: "wrappedPrivateKey",
          publicKey: "publicKey",
        },
      },
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

    describe("key management sync handler", () => {
      const syncResponseWithUserDecryption = (userDecryption: Record<string, unknown>) =>
        new SyncResponse({
          profile: {
            id: user1,
            accountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          folders: [],
          collections: [],
          ciphers: [],
          sends: [],
          domains: [],
          policies: [],
          userDecryption,
        });

      it("passes an empty list of WebAuthn PRF options when the server reported none", async () => {
        apiService.getSync.mockResolvedValue(syncResponseWithUserDecryption({}));

        await sut.fullSync(true);

        const data = cryptoSyncHandler.on_sync.mock.calls[0][0];
        expect(data.userDecryption?.webAuthnPrfOptions).toEqual([]);
      });

      it("passes the WebAuthn PRF options through", async () => {
        apiService.getSync.mockResolvedValue(
          syncResponseWithUserDecryption({
            webAuthnPrfOptions: [
              {
                encryptedPrivateKey: "2.aXY=|ZGF0YQ==|bWFj",
                encryptedUserKey: "4.dXNlcktleQ==",
                credentialId: "credential-id",
                transports: ["internal", "hybrid"],
              },
            ],
          }),
        );

        await sut.fullSync(true);

        const data = cryptoSyncHandler.on_sync.mock.calls[0][0];
        expect(data.userDecryption?.webAuthnPrfOptions).toEqual([
          {
            encryptedPrivateKey: "2.aXY=|ZGF0YQ==|bWFj",
            encryptedUserKey: "4.dXNlcktleQ==",
            credentialId: "credential-id",
            transports: ["internal", "hybrid"],
          },
        ]);
      });

      it("drops WebAuthn PRF options that are missing a wrapped key", async () => {
        apiService.getSync.mockResolvedValue(
          syncResponseWithUserDecryption({
            webAuthnPrfOptions: [
              { credentialId: "no-keys", transports: [] },
              {
                encryptedPrivateKey: "2.aXY=|ZGF0YQ==|bWFj",
                encryptedUserKey: "4.dXNlcktleQ==",
                credentialId: "credential-id",
                transports: [],
              },
            ],
          }),
        );

        await sut.fullSync(true);

        const data = cryptoSyncHandler.on_sync.mock.calls[0][0];
        expect(data.userDecryption?.webAuthnPrfOptions).toEqual([
          expect.objectContaining({ credentialId: "credential-id" }),
        ]);
      });

      it("passes the master password unlock data and upgrade token through", async () => {
        apiService.getSync.mockResolvedValue(
          syncResponseWithUserDecryption({
            masterPasswordUnlock: {
              salt: "test@example.com",
              kdf: { kdfType: 0, iterations: 600000 },
              masterKeyEncryptedUserKey: "encryptedUserKey",
            },
            v2UpgradeToken: {
              wrappedUserKey1: "wrappedUserKey1",
              wrappedUserKey2: "wrappedUserKey2",
            },
          }),
        );

        await sut.fullSync(true);

        const data = cryptoSyncHandler.on_sync.mock.calls[0][0];
        expect(data.userDecryption?.masterPasswordUnlock).toEqual(
          expect.objectContaining({ salt: "test@example.com" }),
        );
        // The SDK's V2UpgradeToken has no serde rename, so its fields stay snake_case.
        expect(data.userDecryption?.v2UpgradeToken).toEqual({
          wrapped_user_key_1: "wrappedUserKey1",
          wrapped_user_key_2: "wrappedUserKey2",
        });
      });

      it("leaves userDecryption undefined when the server reported none", async () => {
        apiService.getSync.mockResolvedValue(emptySyncResponse);

        await sut.fullSync(true);

        const data = cryptoSyncHandler.on_sync.mock.calls[0][0];
        expect(data.userDecryption).toBeUndefined();
        // Current servers always return account keys.
        expect(data.accountCryptographicState).toBeDefined();
      });

      it("fails the sync and skips the remaining sync handlers when the handler rejects the sync", async () => {
        apiService.getSync.mockResolvedValue(syncResponseWithUserDecryption({}));
        cryptoSyncHandler.on_sync.mockRejectedValue(new Error("boom"));

        await expect(sut.fullSync(true)).resolves.toBe(false);

        expect(folderService.replace).not.toHaveBeenCalled();
        expect(policyService.replace).not.toHaveBeenCalled();
      });

      it("throws when the handler rejects the sync and allowThrowOnError is set", async () => {
        apiService.getSync.mockResolvedValue(syncResponseWithUserDecryption({}));
        cryptoSyncHandler.on_sync.mockRejectedValue(new Error("boom"));

        await expect(sut.fullSync(true, { allowThrowOnError: true })).rejects.toThrow("boom");
      });
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
      const user2 = "user2" as UserId;

      let activeAccount: BehaviorSubject<Account>;
      let lastSyncDates: Record<UserId, Date | null>;

      const syncResponseFor = (userId: UserId) =>
        new SyncResponse({
          profile: {
            id: userId,
            accountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          folders: [],
          collections: [],
          ciphers: [],
          sends: [],
          domains: [],
          policies: [],
        });

      const deferred = <T>() => {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((r) => (resolve = r));
        return { promise, resolve };
      };

      const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

      beforeEach(() => {
        activeAccount = new BehaviorSubject({ id: user1 } as Account);
        accountService.activeAccount$ = activeAccount;
        lastSyncDates = { [user1]: null, [user2]: null };
        stateProvider.getUser.mockImplementation(
          (userId) =>
            ({
              state$: of(lastSyncDates[userId]),
              update: jest.fn(),
            }) satisfies Partial<SingleUserState<Date | null>> as unknown as SingleUserState<any>,
        );
      });

      it("does not refresh the token when a sync for the same user is already in flight", async () => {
        const user1Sync = deferred<SyncResponse>();
        apiService.getSync.mockReturnValueOnce(user1Sync.promise);

        const loginSync = sut.fullSync(true, { skipTokenRefresh: true });
        await flushPromises();
        const catchUpSync = sut.fullSync(false);
        await flushPromises();
        user1Sync.resolve(syncResponseFor(user1));
        await Promise.all([loginSync, catchUpSync]);

        expect(apiService.refreshIdentityToken).not.toHaveBeenCalled();
        expect(apiService.getSync).toHaveBeenCalledTimes(1);
      });

      it("syncs each user separately when the active account changes while a sync is in flight", async () => {
        const user1Sync = deferred<SyncResponse>();
        apiService.getSync
          .mockReturnValueOnce(user1Sync.promise)
          .mockResolvedValueOnce(syncResponseFor(user2));

        const user1FullSync = sut.fullSync(true);
        await flushPromises();
        activeAccount.next({ id: user2 } as Account);
        const user2FullSync = sut.fullSync(true);
        await flushPromises();
        user1Sync.resolve(syncResponseFor(user1));
        await Promise.all([user1FullSync, user2FullSync]);

        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(2);
        expect(apiService.refreshIdentityToken).toHaveBeenNthCalledWith(1, user1);
        expect(apiService.refreshIdentityToken).toHaveBeenNthCalledWith(2, user2);
        expect(apiService.getSync).toHaveBeenCalledTimes(2);
        expect(apiService.getSync).toHaveBeenNthCalledWith(1, user1);
        expect(apiService.getSync).toHaveBeenNthCalledWith(2, user2);
        expect(folderService.replace).toHaveBeenCalledWith({}, user1);
        expect(folderService.replace).toHaveBeenCalledWith({}, user2);
      });

      it("sends no requests beyond the revision date check for a switched-to user whose vault is unchanged while another user's sync is in flight", async () => {
        lastSyncDates[user2] = new Date(2);
        apiService.getAccountRevisionDate.mockResolvedValue(new Date(1).getTime());
        const user1Sync = deferred<SyncResponse>();
        apiService.getSync.mockReturnValueOnce(user1Sync.promise);

        const user1FullSync = sut.fullSync(true);
        await flushPromises();
        activeAccount.next({ id: user2 } as Account);
        const user2FullSync = sut.fullSync(false);
        await flushPromises();
        user1Sync.resolve(syncResponseFor(user1));

        await expect(user2FullSync).resolves.toBe(false);
        await user1FullSync;
        expect(apiService.getAccountRevisionDate).toHaveBeenCalledWith(user2);
        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
        expect(apiService.refreshIdentityToken).toHaveBeenCalledWith(user1);
        expect(apiService.getSync).toHaveBeenCalledTimes(1);
        expect(apiService.getSync).toHaveBeenCalledWith(user1);
      });

      it("sends a separate token refresh and sync for a switched-to user whose vault changed while another user's sync is in flight", async () => {
        lastSyncDates[user2] = new Date(1);
        apiService.getAccountRevisionDate.mockResolvedValue(new Date(2).getTime());
        const user1Sync = deferred<SyncResponse>();
        apiService.getSync
          .mockReturnValueOnce(user1Sync.promise)
          .mockResolvedValueOnce(syncResponseFor(user2));

        const user1FullSync = sut.fullSync(true);
        await flushPromises();
        activeAccount.next({ id: user2 } as Account);
        const user2FullSync = sut.fullSync(false);
        await flushPromises();
        user1Sync.resolve(syncResponseFor(user1));

        await expect(user2FullSync).resolves.toBe(true);
        await user1FullSync;
        expect(apiService.getAccountRevisionDate).toHaveBeenCalledWith(user2);
        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(2);
        expect(apiService.refreshIdentityToken).toHaveBeenNthCalledWith(2, user2);
        expect(apiService.getSync).toHaveBeenCalledTimes(2);
        expect(apiService.getSync).toHaveBeenNthCalledWith(2, user2);
        expect(folderService.replace).toHaveBeenCalledWith({}, user2);
      });

      it("checks the last sync and revision date of the starting user when the active account changes mid-sync", async () => {
        lastSyncDates[user1] = new Date(2);
        apiService.getAccountRevisionDate.mockResolvedValue(new Date(1).getTime());
        const authStatus = new Subject<AuthenticationStatus>();
        authService.authStatusFor$.mockReturnValueOnce(authStatus);

        const user1FullSync = sut.fullSync(false);
        await flushPromises();
        activeAccount.next({ id: user2 } as Account);
        authStatus.next(AuthenticationStatus.Unlocked);

        await expect(user1FullSync).resolves.toBe(false);
        expect(apiService.getAccountRevisionDate).toHaveBeenCalledWith(user1);
        expect(apiService.getSync).not.toHaveBeenCalled();
      });

      it("refreshes the token and fetches the sync for the starting user when the active account changes mid-sync", async () => {
        const authStatus = new Subject<AuthenticationStatus>();
        authService.authStatusFor$.mockReturnValueOnce(authStatus);

        const user1FullSync = sut.fullSync(true);
        await flushPromises();
        activeAccount.next({ id: user2 } as Account);
        authStatus.next(AuthenticationStatus.Unlocked);
        await user1FullSync;

        expect(apiService.refreshIdentityToken).toHaveBeenCalledWith(user1);
        expect(apiService.getSync).toHaveBeenCalledWith(user1);
      });

      it("sends one sync request for same-user syncs that overlap", async () => {
        const user1Sync = deferred<SyncResponse>();
        apiService.getSync.mockReturnValueOnce(user1Sync.promise);

        const fullSyncs = [sut.fullSync(true), sut.fullSync(false), sut.fullSync(false)];
        await flushPromises();
        user1Sync.resolve(syncResponseFor(user1));
        await Promise.all(fullSyncs);

        expect(apiService.getSync).toHaveBeenCalledTimes(1);
      });

      it("sends one token refresh for same-user syncs that overlap before the sync request is sent", async () => {
        const refresh = deferred<void>();
        apiService.refreshIdentityToken.mockReturnValueOnce(refresh.promise);

        const fullSyncs = [sut.fullSync(true), sut.fullSync(true)];
        await flushPromises();
        refresh.resolve();
        await Promise.all(fullSyncs);

        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
        expect(apiService.getSync).toHaveBeenCalledTimes(1);
      });

      it("reuses the sync response for a same-user sync that starts while the response is processed", async () => {
        const processing = deferred<void>();
        cryptoSyncHandler.on_sync.mockReturnValueOnce(processing.promise);

        const firstSync = sut.fullSync(true);
        await flushPromises();
        const secondSync = sut.fullSync(true);
        await flushPromises();
        processing.resolve();
        await Promise.all([firstSync, secondSync]);

        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(1);
        expect(apiService.getSync).toHaveBeenCalledTimes(1);
      });

      it("sends new requests after a failed sync", async () => {
        apiService.getSync.mockRejectedValueOnce(new Error("not connected"));

        await expect(sut.fullSync(true)).resolves.toBe(false);
        await expect(sut.fullSync(true)).resolves.toBe(true);

        expect(apiService.refreshIdentityToken).toHaveBeenCalledTimes(2);
        expect(apiService.getSync).toHaveBeenCalledTimes(2);
      });

      it("clears the in-flight calls when the syncs complete", async () => {
        await Promise.all([sut.fullSync(true), sut.fullSync(true)]);

        expect(sut["inFlightApiCalls"].size).toBe(0);
      });

      it("keeps a newer sync's in-flight calls when an older sync for the same user completes", async () => {
        // The first two syncs share one sync request. The second pauses in processing until a
        // third sync has started a new request.
        const firstRequest = deferred<SyncResponse>();
        const secondRequest = deferred<SyncResponse>();
        apiService.getSync
          .mockReturnValueOnce(firstRequest.promise)
          .mockReturnValueOnce(secondRequest.promise);
        const secondSyncProcessing = deferred<void>();
        cryptoSyncHandler.on_sync
          .mockResolvedValueOnce(undefined)
          .mockReturnValueOnce(secondSyncProcessing.promise);

        const firstSync = sut.fullSync(true);
        await flushPromises();
        const secondSync = sut.fullSync(true);
        await flushPromises();
        firstRequest.resolve(syncResponseFor(user1));
        await firstSync;

        const thirdSync = sut.fullSync(true);
        await flushPromises();
        secondSyncProcessing.resolve();
        await secondSync;

        const fourthSync = sut.fullSync(true);
        await flushPromises();
        secondRequest.resolve(syncResponseFor(user1));
        await Promise.all([thirdSync, fourthSync]);

        expect(apiService.getSync).toHaveBeenCalledTimes(2);
      });
    });

    describe("mutate 'last update time'", () => {
      let mockUserState: { state$: Observable<Date>; update: jest.Mock };

      const setupMockUserState = () => {
        const mockUserState = { state$: of(new Date(1)), update: jest.fn() };
        jest.spyOn(stateProvider, "getUser").mockReturnValue(mockUserState as any);
        return mockUserState;
      };

      const setupSyncScenario = (revisionDate: Date, lastSyncDate: Date) => {
        jest.spyOn(apiService, "getAccountRevisionDate").mockResolvedValue(revisionDate.getTime());
        mockUserState.state$ = of(lastSyncDate);
      };

      const expectUpdateCallCount = (
        mockUserState: { update: jest.Mock },
        expectedCount: number,
      ) => {
        if (expectedCount === 0) {
          expect(mockUserState.update).not.toHaveBeenCalled();
        } else {
          expect(mockUserState.update).toHaveBeenCalledTimes(expectedCount);
        }
      };

      const defaultSyncOptions = { allowThrowOnError: true, skipTokenRefresh: true };
      const errorTolerantSyncOptions = { allowThrowOnError: false, skipTokenRefresh: true };

      beforeEach(() => {
        mockUserState = setupMockUserState();
      });

      it("uses the current time when a sync is forced", async () => {
        // Mock the value of this observable because it's used in `syncProfile`. Without it, the test breaks.
        keyConnectorService.convertAccountRequired$ = of(false);

        jest.useFakeTimers({ now: Date.now() });

        await sut.fullSync(true, defaultSyncOptions);

        expectUpdateCallCount(mockUserState, 1);
        // Get the first and only call to update(...)
        const updateCall = mockUserState.update.mock.calls[0];
        // Get the first argument to update(...) -- this will be the date callback that returns the date of the last successful sync
        const dateCallback = updateCall[0];
        const actualDate = dateCallback() as Date;

        expect(actualDate.getTime()).toEqual(jest.now());
        jest.useRealTimers();
      });

      it("updates last sync time when no sync is necessary", async () => {
        const revisionDate = new Date(1);
        setupSyncScenario(revisionDate, revisionDate);

        const syncResult = await sut.fullSync(false, defaultSyncOptions);

        // Sync should complete but return false since no sync was needed
        expect(syncResult).toBe(false);
        expectUpdateCallCount(mockUserState, 1);
      });

      it("updates last sync time when sync is successful", async () => {
        setupSyncScenario(new Date(2), new Date(1));

        const syncResult = await sut.fullSync(false, defaultSyncOptions);

        expect(syncResult).toBe(true);
        expectUpdateCallCount(mockUserState, 1);
      });

      describe("error scenarios", () => {
        it("does not update last sync time when sync fails", async () => {
          apiService.getSync.mockRejectedValue(new Error("not connected"));

          const syncResult = await sut.fullSync(true, errorTolerantSyncOptions);

          expect(syncResult).toBe(false);
          expectUpdateCallCount(mockUserState, 0);
        });

        it("does not update last sync time when account revision check fails", async () => {
          jest
            .spyOn(apiService, "getAccountRevisionDate")
            .mockRejectedValue(new Error("not connected"));

          const syncResult = await sut.fullSync(false, errorTolerantSyncOptions);

          expect(syncResult).toBe(false);
          expectUpdateCallCount(mockUserState, 0);
        });
      });
    });

    describe("policy sync", () => {
      it("syncs policies from response.policies into policyService", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          Policies: [{ Id: "policy1", OrganizationId: "org1", Type: 0, Enabled: true }],
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(policyService.replace).toHaveBeenCalledWith(
          expect.objectContaining({ policy1: expect.any(Object) }),
          user1,
        );
      });

      it("clears policiesNew state when the response contains no policies", async () => {
        apiService.getSync.mockResolvedValue(emptySyncResponse);

        await sut.fullSync(true);

        expect(newPolicyService.replace).toHaveBeenCalledWith({}, user1);
      });

      it("calls newPolicyService.replace when policiesNew is present in the response", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          PoliciesNew: [{ Id: "policy-new-1", OrganizationId: "org1", Type: 0, Enabled: true }],
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(newPolicyService.replace).toHaveBeenCalledWith(
          expect.objectContaining({ "policy-new-1": expect.any(Object) }),
          user1,
        );
      });

      it("routes policies and policiesNew to their respective services independently", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          Policies: [{ Id: "old-policy", OrganizationId: "org1", Type: 0, Enabled: true }],
          PoliciesNew: [{ Id: "new-policy", OrganizationId: "org1", Type: 0, Enabled: true }],
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(policyService.replace).toHaveBeenCalledWith(
          expect.objectContaining({ "old-policy": expect.any(Object) }),
          user1,
        );
        expect(newPolicyService.replace).toHaveBeenCalledWith(
          expect.objectContaining({ "new-policy": expect.any(Object) }),
          user1,
        );
      });

      it("falls back to policies when policiesNew is absent", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          Policies: [{ Id: "policy1", OrganizationId: "org1", Type: 0, Enabled: true }],
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(newPolicyService.replace).toHaveBeenCalledWith(
          expect.objectContaining({ policy1: expect.any(Object) }),
          user1,
        );
      });

      it("falls back to policies when policiesNew is an empty array", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
          },
          Policies: [{ Id: "policy1", OrganizationId: "org1", Type: 0, Enabled: true }],
          PoliciesNew: [],
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(newPolicyService.replace).toHaveBeenCalledWith(
          expect.objectContaining({ policy1: expect.any(Object) }),
          user1,
        );
      });
    });

    describe("account email sync", () => {
      const newEmail = "new@example.com";

      const emailSyncResponse = new SyncResponse({
        Profile: { Id: user1, Email: newEmail },
      });

      it("sets the account email when the self-service change email flag is enabled", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);
        apiService.getSync.mockResolvedValue(emailSyncResponse);

        await sut.fullSync(true);

        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM30806_SelfServiceChangeEmailCommand,
        );
        expect(accountService.setAccountEmail).toHaveBeenCalledWith(user1, newEmail);
      });

      it("does not set the account email when the self-service change email flag is disabled", async () => {
        configService.getFeatureFlag.mockResolvedValue(false);
        apiService.getSync.mockResolvedValue(emailSyncResponse);

        await sut.fullSync(true);

        expect(accountService.setAccountEmail).not.toHaveBeenCalled();
      });
    });

    describe("organization sync", () => {
      it("syncs organizations from profile.organizations when organizationsNew is absent", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
            Organizations: [{ Id: "org1", Status: OrganizationUserStatusType.Confirmed }],
            ProviderOrganizations: [] as any[],
          },
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(organizationService.replace).toHaveBeenCalledWith(
          {
            org1: expect.objectContaining({
              id: "org1",
              status: OrganizationUserStatusType.Confirmed,
              isMember: true,
              isProviderUser: false,
            }),
          },
          user1,
        );
      });

      it("prefers organizationsNew over organizations when both are present", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
            Organizations: [{ Id: "old-org", Status: OrganizationUserStatusType.Confirmed }],
            OrganizationsNew: [{ Id: "new-org", Status: OrganizationUserStatusType.Accepted }],
            ProviderOrganizations: [] as any[],
          },
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(organizationService.replace).toHaveBeenCalledWith(
          {
            "new-org": expect.objectContaining({
              id: "new-org",
              status: OrganizationUserStatusType.Accepted,
              isMember: true,
              isProviderUser: false,
            }),
          },
          user1,
        );
      });

      it("merges provider organizations regardless of source", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
            AccountKeys: {
              publicKeyEncryptionKeyPair: {
                wrappedPrivateKey: "wrappedPrivateKey",
                publicKey: "publicKey",
              },
            },
            Organizations: [] as any[],
            OrganizationsNew: [{ Id: "org1", Status: OrganizationUserStatusType.Accepted }],
            ProviderOrganizations: [
              { Id: "provider-org", Status: OrganizationUserStatusType.Confirmed },
            ],
          },
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true);

        expect(organizationService.replace).toHaveBeenCalledWith(
          {
            org1: expect.objectContaining({
              id: "org1",
              status: OrganizationUserStatusType.Accepted,
              isMember: true,
              isProviderUser: false,
            }),
            "provider-org": expect.objectContaining({
              id: "provider-org",
              isMember: false,
              isProviderUser: true,
            }),
          },
          user1,
        );
      });
    });

    describe("retry pending send deletions", () => {
      it("retries pending send deletions when the flag is on", async () => {
        configService.getFeatureFlag.mockImplementation((flag) =>
          Promise.resolve(flag === FeatureFlag.Pm30110SdkSendsApi),
        );

        await sut.fullSync(true);

        expect(sendsClient.retry_pending_deletions).toHaveBeenCalledTimes(1);
      });

      it("does not retry pending send deletions when the flag is off", async () => {
        configService.getFeatureFlag.mockResolvedValue(false);

        await sut.fullSync(true);

        expect(sendsClient.retry_pending_deletions).not.toHaveBeenCalled();
      });

      it("completes the sync and logs the error when retrying pending send deletions rejects", async () => {
        configService.getFeatureFlag.mockImplementation((flag) =>
          Promise.resolve(flag === FeatureFlag.Pm30110SdkSendsApi),
        );
        const error = new Error("still offline");
        sendsClient.retry_pending_deletions.mockRejectedValue(error);

        await expect(sut.fullSync(true)).resolves.toBe(true);

        expect(logService.error).toHaveBeenCalledWith(expect.any(String), error);
      });
    });
  });

  describe("syncUpsertSend", () => {
    const sendGuid = Utils.newGuid();

    const notification = new SyncSendNotification({
      Id: sendGuid,
      UserId: user1,
      RevisionDate: "2025-01-02T00:00:00.000Z",
    });

    beforeEach(() => {
      accountService.activeAccount$ = of({ id: user1 } as Account);
      Matrix.autoMockMethod(authService.authStatusFor$, () => of(AuthenticationStatus.Unlocked));
      // Treat this as a new send (create): no local copy exists yet.
      sendService.get$.mockReturnValue(of(undefined));
      tokenService.hasAccessToken$.mockReturnValue(of(true));
    });

    it("fetches the send through the SDK when the flag is on", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);
      const sdkSend = {
        id: sendGuid,
        type: SendType.Text,
        accessCount: 0,
        disabled: false,
        hideEmail: false,
        authType: 2,
        revisionDate: "2025-01-02T00:00:00.000Z",
        deletionDate: "2025-01-09T00:00:00.000Z",
        text: { text: "2.enc", hidden: false },
      };
      sendsClient.fetch.mockResolvedValue(sdkSend);

      const result = await sut.syncUpsertSend(notification, false);

      expect(result).toBe(true);
      expect(sendsClient.fetch).toHaveBeenCalledWith(sendGuid);
      expect(sendApiService.getSend).not.toHaveBeenCalled();
      expect(messageSender.send).toHaveBeenCalledWith("syncedUpsertedSend", { sendId: sendGuid });
    });

    it("fetches the send through the legacy API and upserts it when the flag is off", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);
      const remoteSend = { id: sendGuid } as any;
      sendApiService.getSend.mockResolvedValue(remoteSend);

      const result = await sut.syncUpsertSend(notification, false);

      expect(result).toBe(true);
      expect(sendApiService.getSend).toHaveBeenCalledWith(sendGuid);
      expect(sendsClient.fetch).not.toHaveBeenCalled();
      expect(sendService.upsert).toHaveBeenCalledWith(new SendData(remoteSend));
      expect(messageSender.send).toHaveBeenCalledWith("syncedUpsertedSend", { sendId: sendGuid });
    });
  });

  describe("SyncResponse", () => {
    it("maps PoliciesNew from the server response", () => {
      const response = new SyncResponse({
        Profile: {
          Id: user1,
          AccountKeys: {
            publicKeyEncryptionKeyPair: {
              wrappedPrivateKey: "wrappedPrivateKey",
              publicKey: "publicKey",
            },
          },
        },
        PoliciesNew: [{ Id: "policy1", OrganizationId: "org1", Type: 1, Enabled: true }],
      });

      expect(response.policiesNew).toHaveLength(1);
      expect(response.policiesNew![0].id).toBe("policy1");
      expect(response.policiesNew![0].organizationId).toBe("org1");
    });

    it("leaves policiesNew undefined when the property is absent from the server response", () => {
      const response = new SyncResponse({
        Profile: {
          Id: user1,
          AccountKeys: {
            publicKeyEncryptionKeyPair: {
              wrappedPrivateKey: "wrappedPrivateKey",
              publicKey: "publicKey",
            },
          },
        },
      });

      expect(response.policiesNew).toBeUndefined();
    });

    it("parses policies and policiesNew independently", () => {
      const response = new SyncResponse({
        Profile: {
          Id: user1,
          AccountKeys: {
            publicKeyEncryptionKeyPair: {
              wrappedPrivateKey: "wrappedPrivateKey",
              publicKey: "publicKey",
            },
          },
        },
        Policies: [{ Id: "old", OrganizationId: "org1", Type: 0, Enabled: true }],
        PoliciesNew: [{ Id: "new", OrganizationId: "org1", Type: 0, Enabled: false }],
      });

      expect(response.policies).toHaveLength(1);
      expect(response.policies![0].id).toBe("old");
      expect(response.policiesNew).toHaveLength(1);
      expect(response.policiesNew![0].id).toBe("new");
    });
  });
});
