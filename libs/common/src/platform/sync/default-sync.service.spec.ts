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
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

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
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
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

    describe("syncUserDecryption", () => {
      const salt = "test@example.com";
      const kdf = new PBKDF2KdfConfig(600_000);
      const encryptedUserKey = "testUserKey";

      it("should set master password unlock when present in user decryption", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
          },
          UserDecryption: {
            MasterPasswordUnlock: {
              Salt: salt,
              Kdf: {
                KdfType: kdf.kdfType,
                Iterations: kdf.iterations,
              },
              MasterKeyEncryptedUserKey: encryptedUserKey,
            },
          },
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true, true);

        expect(masterPasswordAbstraction.setMasterPasswordUnlockData).toHaveBeenCalledWith(
          new MasterPasswordUnlockData(
            salt as MasterPasswordSalt,
            kdf,
            encryptedUserKey as MasterKeyWrappedUserKey,
          ),
          user1,
        );
      });

      it("should not set master password unlock when not present in user decryption", async () => {
        const syncResponse = new SyncResponse({
          Profile: {
            Id: user1,
          },
          UserDecryption: {},
        });
        apiService.getSync.mockResolvedValue(syncResponse);

        await sut.fullSync(true, true);

        expect(masterPasswordAbstraction.setMasterPasswordUnlockData).not.toHaveBeenCalled();
      });
    });

    describe("mutate 'last update time'", () => {
      let mockUserState: { update: jest.Mock };

      const setupMockUserState = () => {
        const mockUserState = { update: jest.fn() };
        jest.spyOn(stateProvider, "getUser").mockReturnValue(mockUserState as any);
        return mockUserState;
      };

      const setupSyncScenario = (revisionDate: Date, lastSyncDate: Date) => {
        jest.spyOn(apiService, "getAccountRevisionDate").mockResolvedValue(revisionDate.getTime());
        jest.spyOn(sut as any, "getLastSync").mockResolvedValue(lastSyncDate);
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

        // Baseline date/time to compare sync time to, in order to avoid needing to use some kind of fake date provider.
        const beforeSync = Date.now();

        // send it!
        await sut.fullSync(true, defaultSyncOptions);

        expectUpdateCallCount(mockUserState, 1);
        // Get the first and only call to update(...)
        const updateCall = mockUserState.update.mock.calls[0];
        // Get the first argument to update(...) -- this will be the date callback that returns the date of the last successful sync
        const dateCallback = updateCall[0];
        const actualTime = dateCallback() as Date;

        expect(Math.abs(actualTime.getTime() - beforeSync)).toBeLessThan(1);
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
  });
});
