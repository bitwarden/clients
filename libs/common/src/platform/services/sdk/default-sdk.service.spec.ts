import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, Subject, throwError } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptedString, PBKDF2KdfConfig, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { Measurement } from "@bitwarden/logging";
import {
  CryptoClient,
  PasswordManagerClient,
  UnlockClient,
  UnsignedSharedKey,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";

import {
  ObservableTracker,
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
  mockAccountInfoWith,
  mockManagedSettingsService,
} from "../../../../spec";
import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo } from "../../../auth/abstractions/account.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { DefaultFeatureFlagValue, FeatureFlag } from "../../../enums/feature-flag.enum";
import { AccountCryptographicStateService } from "../../../key-management/account-cryptography/account-cryptographic-state.service";
import { V2UpgradeTokenStateService } from "../../../key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { AppIdService } from "../../abstractions/app-id.service";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { asUuid, SdkUnlockRequest, UserNotLoggedInError } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";
import { Utils } from "../../misc/utils";

import { DefaultSdkService } from "./default-sdk.service";

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    // Simulate successful WASM load
    return Promise.resolve();
  }
}

describe("DefaultSdkService", () => {
  const appId = "app-id";

  let sdkClientFactory!: MockProxy<SdkClientFactory>;
  let environmentService!: MockProxy<EnvironmentService>;
  let platformUtilsService!: MockProxy<PlatformUtilsService>;
  let kdfConfigService!: MockProxy<KdfConfigService>;
  let keyService!: MockProxy<KeyService>;
  let accountCryptographicStateService!: MockProxy<AccountCryptographicStateService>;
  let configService!: MockProxy<ConfigService>;
  let service!: DefaultSdkService;
  let accountService!: FakeAccountService;
  let fakeStateProvider!: FakeStateProvider;
  let apiService!: MockProxy<ApiService>;
  let upgradeTokenStateService!: MockProxy<V2UpgradeTokenStateService>;
  let appIdService!: MockProxy<AppIdService>;
  let logService!: MockProxy<LogService>;
  let tokenService!: MockProxy<TokenService>;

  beforeEach(async () => {
    await new TestSdkLoadService().loadAndInit();

    sdkClientFactory = mock<SdkClientFactory>();
    environmentService = mock<EnvironmentService>();
    platformUtilsService = mock<PlatformUtilsService>();
    kdfConfigService = mock<KdfConfigService>();
    keyService = mock<KeyService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    apiService = mock<ApiService>();
    const mockUserId = Utils.newGuid() as UserId;
    accountService = mockAccountServiceWith(mockUserId);
    fakeStateProvider = new FakeStateProvider(accountService);
    configService = mock<ConfigService>();
    upgradeTokenStateService = mock<V2UpgradeTokenStateService>();
    appIdService = mock<AppIdService>();
    appIdService.getAppId.mockResolvedValue(appId);

    configService.serverConfig$ = new BehaviorSubject(null);
    logService = mock<LogService>({ startMeasurement: () => mock<Measurement>() });
    tokenService = mock<TokenService>();
    tokenService.hasAccessToken$.mockReturnValue(of(true));

    // Can't use `of(mock<Environment>())` for some reason
    environmentService.environment$ = new BehaviorSubject(mock<Environment>());
  });

  /** The rollout flag is captured on first use, so stub it before creating the service. */
  function createService(): DefaultSdkService {
    return new DefaultSdkService(
      sdkClientFactory,
      environmentService,
      platformUtilsService,
      accountService,
      () => kdfConfigService,
      () => keyService,
      () => accountCryptographicStateService,
      () => apiService,
      fakeStateProvider,
      () => configService,
      upgradeTokenStateService,
      mockManagedSettingsService(),
      appIdService,
      logService,
      () => tokenService,
    );
  }

  describe("client$ without BW user", () => {
    beforeEach(() => {
      sdkClientFactory.createSdkClient.mockResolvedValue(createMockClient());
      service = createService();
    });

    it("creates the SDK client with the app ID as the device identifier", async () => {
      await firstValueFrom(service.client$);

      const [, settings] = sdkClientFactory.createSdkClient.mock.calls[0];
      expect(settings?.deviceIdentifier).toBe(appId);
    });
  });

  describe.each([
    ["the long-lived client flag is off", () => of(false)],
    ["the long-lived client flag lookup fails", () => throwError(() => new Error("lookup failed"))],
  ])("given %s", (_, flag$) => {
    beforeEach(() => {
      configService.userCachedFeatureFlag$.mockImplementation(flag$ as any);
      service = createService();
    });

    it("creates no clients for the logged-in accounts", async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
    });

    describe("userClient$", () => {
      describe("given the user is logged in", () => {
        const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;
        beforeEach(() => {
          environmentService.getEnvironment$
            .calledWith(userId)
            .mockReturnValue(new BehaviorSubject(mock<Environment>()));
          accountService.accounts$ = of({
            [userId]: mockAccountInfoWith({
              email: "email",
              name: "name",
            }),
          });
          kdfConfigService.getKdfConfig$
            .calledWith(userId)
            .mockReturnValue(of(PBKDF2KdfConfig.createDefault()));
          keyService.userKey$
            .calledWith(userId)
            .mockReturnValue(of(new SymmetricCryptoKey(new Uint8Array(64)) as UserKey));
          keyService.encryptedOrgKeys$.calledWith(userId).mockReturnValue(of({}));
          accountCryptographicStateService.accountCryptographicState$
            .calledWith(userId)
            .mockReturnValue(
              of({
                V1: {
                  private_key: "private-key" as EncryptedString,
                },
              }),
            );
          upgradeTokenStateService.v2UpgradeToken$.calledWith(userId).mockReturnValue(of(null));
          service = createService();
        });

        describe("given the SDK client factory creates a client", () => {
          let mockClient!: MockProxy<PasswordManagerClient>;

          beforeEach(() => {
            mockClient = createMockClient();
            sdkClientFactory.createSdkClient.mockResolvedValue(mockClient);
          });

          it("creates an internal SDK client when called the first time", async () => {
            await firstValueFrom(service.userClient$(userId));

            expect(sdkClientFactory.createSdkClient).toHaveBeenCalled();
          });

          it("creates the SDK client with the app ID as the device identifier", async () => {
            await firstValueFrom(service.userClient$(userId));

            const [, settings] = sdkClientFactory.createSdkClient.mock.calls[0];
            expect(settings?.deviceIdentifier).toBe(appId);
          });

          it("provides the user's access token from the API service to the SDK client", async () => {
            apiService.getActiveBearerToken.calledWith(userId).mockResolvedValue("access-token");
            await firstValueFrom(service.userClient$(userId));

            const [tokenProvider] = sdkClientFactory.createSdkClient.mock.calls[0];
            await expect(tokenProvider.get_access_token()).resolves.toBe("access-token");
            expect(apiService.getActiveBearerToken).toHaveBeenCalledWith(userId);
          });

          it("does not create an SDK client when called the second time with same userId", async () => {
            const subject_1 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);
            const subject_2 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);

            // Use subjects to ensure the subscription is kept alive
            service.userClient$(userId).subscribe(subject_1);
            service.userClient$(userId).subscribe(subject_2);

            // Let the async client initialization in internalClient$ settle.
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(subject_1.value.take().value).toBe(mockClient);
            expect(subject_2.value.take().value).toBe(mockClient);
            expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
          });

          it("destroys the internal SDK client when all subscriptions are closed", async () => {
            jest.useFakeTimers();
            const subject_1 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);
            const subject_2 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);
            const subscription_1 = service.userClient$(userId).subscribe(subject_1);
            const subscription_2 = service.userClient$(userId).subscribe(subject_2);
            await jest.advanceTimersByTimeAsync(0);

            subscription_1.unsubscribe();
            subscription_2.unsubscribe();

            await jest.advanceTimersByTimeAsync(0);
            expect(mockClient.free).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1000);
            expect(mockClient.free).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
          });

          it("does not destroy the internal SDK client if resubscribed within 1 second", async () => {
            jest.useFakeTimers();
            const subject_1 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);
            const subscription_1 = service.userClient$(userId).subscribe(subject_1);
            await jest.advanceTimersByTimeAsync(0);

            subscription_1.unsubscribe();
            await jest.advanceTimersByTimeAsync(500);
            expect(mockClient.free).not.toHaveBeenCalled();

            // Resubscribe before the 1 second delay
            const subject_2 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);
            const subscription_2 = service.userClient$(userId).subscribe(subject_2);
            await jest.advanceTimersByTimeAsync(1000);

            // Client should not be freed since we resubscribed
            expect(mockClient.free).not.toHaveBeenCalled();
            expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
            subscription_2.unsubscribe();
            jest.useRealTimers();
          });

          it("emits a new locked client and frees the previous unlocked client when the userKey is unset", async () => {
            const userKey$ = new BehaviorSubject(
              new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
            );
            keyService.userKey$.calledWith(userId).mockReturnValue(userKey$);

            const userClientTracker = new ObservableTracker(service.userClient$(userId), false);
            await userClientTracker.pauseUntilReceived(1, 200);

            userKey$.next(undefined);
            await userClientTracker.pauseUntilReceived(2);

            expect(mockClient.free).toHaveBeenCalledTimes(1);
            expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(2);
            expect(userClientTracker.emissions[1]).toBeDefined();
          });

          it("completes the subscription and frees the internal SDK client when the environment is unset (logout)", async () => {
            const env$ = new BehaviorSubject<Environment | undefined>(mock<Environment>());
            environmentService.getEnvironment$
              .calledWith(userId)
              .mockReturnValue(env$ as BehaviorSubject<Environment>);

            const userClientTracker = new ObservableTracker(service.userClient$(userId), false);
            await userClientTracker.pauseUntilReceived(1);

            env$.next(undefined);
            await userClientTracker.expectCompletion();

            expect(mockClient.free).toHaveBeenCalledTimes(1);
          });
        });
      });
    });

    describe("push methods", () => {
      const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;

      it("resolves unlock with null without creating a client", async () => {
        await expect(
          service.unlock(userId, {
            userId: asUuid(userId),
            method: { clientManagedState: {} },
            accountCryptographicState: mock<WrappedAccountCryptographicState>(),
          }),
        ).resolves.toBeNull();
        expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
      });

      it("resolves lock, setFlags and setOrgKeys without creating a client", async () => {
        await expect(service.lock(userId)).resolves.toBeUndefined();
        await expect(service.setFlags(userId, new Map([["flag", true]]))).resolves.toBeUndefined();
        await expect(service.setOrgKeys(userId, {})).resolves.toBeUndefined();
        expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
      });

      it("returns from logout without creating a client", () => {
        expect(() => service.logout(userId)).not.toThrow();
        expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
      });
    });

    describe("cryptoReady$", () => {
      const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;

      it("emits true without creating a client", async () => {
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);
        expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
      });

      it("stays true across lock and logout", async () => {
        await service.lock(userId);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);

        service.logout(userId);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);
      });
    });
  });

  describe("given the long-lived client flag is on", () => {
    const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;
    const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    const unlockRequest: SdkUnlockRequest = {
      userId: asUuid(userId),
      method: { clientManagedState: {} },
      accountCryptographicState: mock<WrappedAccountCryptographicState>(),
    };

    let accounts$!: BehaviorSubject<Record<UserId, AccountInfo>>;
    let hasAccessToken$!: BehaviorSubject<boolean>;
    let mockClient!: MockProxy<PasswordManagerClient>;
    let crypto!: MockProxy<CryptoClient>;
    let unlockClient!: MockProxy<UnlockClient>;

    beforeEach(() => {
      configService.userCachedFeatureFlag$.mockReturnValue(of(true) as any);
      accounts$ = new BehaviorSubject<Record<UserId, AccountInfo>>({
        [userId]: mockAccountInfoWith({ email: "email", name: "name" }),
      });
      accountService.accounts$ = accounts$;
      hasAccessToken$ = new BehaviorSubject(true);
      tokenService.hasAccessToken$.mockReturnValue(hasAccessToken$);
      environmentService.getEnvironment$
        .calledWith(userId)
        .mockReturnValue(new BehaviorSubject(mock<Environment>()));
      kdfConfigService.getKdfConfig$
        .calledWith(userId)
        .mockReturnValue(of(PBKDF2KdfConfig.createDefault()));
      upgradeTokenStateService.v2UpgradeToken$.calledWith(userId).mockReturnValue(of(null));

      mockClient = createMockClient();
      crypto = mock<CryptoClient>();
      crypto.get_user_encryption_key.mockResolvedValue(userKey.toBase64());
      mockClient.crypto.mockReturnValue(crypto);
      unlockClient = mock<UnlockClient>();
      unlockClient.lock.mockResolvedValue(undefined);
      mockClient.unlock.mockReturnValue(unlockClient);
      sdkClientFactory.createSdkClient.mockResolvedValue(mockClient);
    });

    /** Lets the accounts subscription and the client build settle. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    async function startUnlocked(): Promise<void> {
      service = createService();
      await settle();
      await service.unlock(userId, unlockRequest);
      await service.setOrgKeys(userId, {});
    }

    it("defaults the flag to off", () => {
      expect(DefaultFeatureFlagValue[FeatureFlag.PM31844_LongLivedSdkClient]).toBe(false);
    });

    describe("userClient$", () => {
      it("creates a token-only client for a logged-in account without unlocking it", async () => {
        service = createService();

        const rc = await firstValueFrom(service.userClient$(userId));

        using ref = rc.take();
        expect(ref.value).toBe(mockClient);
        expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
        expect(crypto.initialize_user_crypto).not.toHaveBeenCalled();
      });

      it("registers the state bridge on the token-only client", async () => {
        service = createService();
        await settle();

        expect(mockClient.km_state_bridge().register_bridge_impl).toHaveBeenCalledTimes(1);
      });

      it("provides the user's access token from the API service to the SDK client", async () => {
        apiService.getActiveBearerToken.calledWith(userId).mockResolvedValue("access-token");
        service = createService();
        await settle();

        const [tokenProvider] = sdkClientFactory.createSdkClient.mock.calls[0];
        await expect(tokenProvider.get_access_token()).resolves.toBe("access-token");
      });

      it("creates one client for many operations and keeps it when every subscription drops", async () => {
        jest.useFakeTimers();
        try {
          service = createService();
          await jest.advanceTimersByTimeAsync(0);
          await service.unlock(userId, unlockRequest);
          await service.setOrgKeys(userId, {});

          for (let i = 0; i < 5; i++) {
            const subscription = service.userClient$(userId).subscribe();
            subscription.unsubscribe();
            await firstValueFrom(service.userClient$(userId));
          }
          await jest.advanceTimersByTimeAsync(5000);

          expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
          expect(mockClient.free).not.toHaveBeenCalled();
        } finally {
          jest.useRealTimers();
        }
      });

      it("dedupes concurrent builds for the same user", async () => {
        service = createService();

        await Promise.all([
          service.unlock(userId, unlockRequest),
          firstValueFrom(service.userClient$(userId)),
        ]);

        expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
      });

      it("waits without emitting or erroring while the client is being built", async () => {
        let resolveClient!: (client: PasswordManagerClient) => void;
        sdkClientFactory.createSdkClient.mockReturnValue(
          new Promise((resolve) => (resolveClient = resolve)),
        );
        service = createService();

        const tracker = new ObservableTracker(service.userClient$(userId), false);
        const error = jest.fn();
        service.userClient$(userId).subscribe({ error });
        await settle();

        expect(tracker.emissions).toHaveLength(0);
        expect(error).not.toHaveBeenCalled();

        resolveClient(mockClient);
        await tracker.pauseUntilReceived(1);
        expect(error).not.toHaveBeenCalled();
      });

      it("errors with UserNotLoggedInError when the user is not logged in", async () => {
        hasAccessToken$.next(false);
        service = createService();

        await expect(firstValueFrom(service.userClient$(userId))).rejects.toThrow(
          UserNotLoggedInError,
        );
        expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
      });

      it("completes and disposes the client when the user logs out", async () => {
        service = createService();
        const tracker = new ObservableTracker(service.userClient$(userId), false);
        await tracker.pauseUntilReceived(1);

        service.logout(userId);
        await logOut();

        await tracker.expectCompletion();
        expect(mockClient.free).toHaveBeenCalledTimes(1);
      });

      it("completes and disposes the client when the token is removed without a logout push", async () => {
        await startUnlocked();
        const tracker = new ObservableTracker(service.userClient$(userId), false);
        await tracker.pauseUntilReceived(1);

        await logOut();

        await tracker.expectCompletion();
        expect(mockClient.free).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("creates no client for an account without an access token", async () => {
        hasAccessToken$.next(false);
        service = createService();
        await settle();

        expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
      });

      it("watches the access token of an account once, however often accounts emit", async () => {
        service = createService();
        await settle();
        const tokenLookups = tokenService.hasAccessToken$.mock.calls.length;

        accounts$.next({ ...accounts$.value });
        await settle();

        expect(tokenService.hasAccessToken$).toHaveBeenCalledTimes(tokenLookups);
        expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
      });

      it("creates a client when the user's access token appears", async () => {
        hasAccessToken$.next(false);
        service = createService();
        await settle();

        hasAccessToken$.next(true);
        await settle();

        expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(service.userClient$(userId))).resolves.toBeDefined();
      });

      it("creates a fresh client when the user logs in again after a logout", async () => {
        service = createService();
        await settle();
        service.logout(userId);
        await logOut();
        const secondClient = createMockClient();
        sdkClientFactory.createSdkClient.mockResolvedValue(secondClient);

        hasAccessToken$.next(true);
        await settle();

        const rc = await firstValueFrom(service.userClient$(userId));
        using ref = rc.take();
        expect(ref.value).toBe(secondClient);
        expect(mockClient.free).toHaveBeenCalledTimes(1);
      });

      it("disposes a client that finishes building after its token was removed, and never publishes it", async () => {
        let resolveClient!: (client: PasswordManagerClient) => void;
        sdkClientFactory.createSdkClient.mockReturnValue(
          new Promise((resolve) => (resolveClient = resolve)),
        );
        service = createService();
        const next = jest.fn();
        service.userClient$(userId).subscribe({ next, error: () => {} });
        await settle();

        hasAccessToken$.next(false);
        await settle();
        resolveClient(mockClient);
        await settle();

        expect(mockClient.free).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
      });

      it("disposes a client that finishes building after its user logged out, and never publishes it", async () => {
        let resolveClient!: (client: PasswordManagerClient) => void;
        sdkClientFactory.createSdkClient.mockReturnValue(
          new Promise((resolve) => (resolveClient = resolve)),
        );
        service = createService();
        const tracker = new ObservableTracker(service.userClient$(userId), false);
        await settle();

        service.logout(userId);
        resolveClient(mockClient);
        await settle();

        expect(mockClient.free).toHaveBeenCalledTimes(1);
        expect(tracker.emissions).toHaveLength(0);
      });
    });

    describe("unlock", () => {
      it("returns the user key it unlocked with", async () => {
        service = createService();

        await expect(service.unlock(userId, unlockRequest)).resolves.toEqual(userKey);
      });

      it("initializes the user crypto from the request and the user's state", async () => {
        service = createService();

        await service.unlock(userId, unlockRequest);

        expect(crypto.initialize_user_crypto).toHaveBeenCalledWith({
          ...unlockRequest,
          email: "email",
          kdfParams: PBKDF2KdfConfig.createDefault().toSdkConfig(),
          upgradeToken: undefined,
        });
      });

      it("clears the keys of an unlocked client before initializing the user crypto", async () => {
        await startUnlocked();
        unlockClient.lock.mockClear();
        crypto.initialize_user_crypto.mockClear();

        await service.unlock(userId, unlockRequest);

        const lock = unlockClient.lock;
        const initialize = crypto.initialize_user_crypto;
        expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
          initialize.mock.invocationCallOrder[0],
        );
      });

      it("does not clear a token-only client, so the user key in state is left alone", async () => {
        service = createService();

        await service.unlock(userId, unlockRequest);

        expect(unlockClient.lock).not.toHaveBeenCalled();
        expect(crypto.initialize_user_crypto).toHaveBeenCalledTimes(1);
      });

      it("clears a client whose earlier unlock failed after initialization started", async () => {
        service = createService();
        crypto.initialize_user_crypto.mockRejectedValueOnce(new Error("wrong password"));
        await expect(service.unlock(userId, unlockRequest)).rejects.toThrow("wrong password");

        await service.unlock(userId, unlockRequest);

        expect(unlockClient.lock).toHaveBeenCalledTimes(1);
      });

      it("throws when there is no client to unlock", async () => {
        sdkClientFactory.createSdkClient.mockImplementation(async () => {
          service.logout(userId);
          return mockClient;
        });
        service = createService();

        await expect(service.unlock(userId, unlockRequest)).rejects.toThrow();
      });

      it("rejects when the client cannot be built", async () => {
        sdkClientFactory.createSdkClient.mockRejectedValue(new Error("build failed"));
        service = createService();

        await expect(service.unlock(userId, unlockRequest)).rejects.toThrow("build failed");
      });

      it("frees a client whose initialization fails, and rejects", async () => {
        jest.mocked(mockClient.km_state_bridge().register_bridge_impl).mockImplementation(() => {
          throw new Error("init failed");
        });
        service = createService();

        await expect(service.unlock(userId, unlockRequest)).rejects.toThrow("init failed");
        expect(mockClient.free).toHaveBeenCalled();
      });
    });

    describe("a lock racing an unlock", () => {
      /** Holds the next call of `fn` until the returned function is called. */
      function holdNext(fn: jest.Mock | jest.MockInstance<any, any>, value?: unknown) {
        let release!: () => void;
        fn.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(value))));
        return () => release();
      }

      it("clears the client and rejects when a lock lands while the user crypto initializes", async () => {
        service = createService();
        await settle();
        const release = holdNext(crypto.initialize_user_crypto);

        const unlock = service.unlock(userId, unlockRequest);
        await settle();
        await service.lock(userId);
        unlockClient.lock.mockClear();
        release();

        await expect(unlock).rejects.toThrow("locked while unlocking");
        expect(unlockClient.lock).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("leaves the client alone for an unlock that was in flight when a lock found no client yet", async () => {
        let resolveClient!: (client: PasswordManagerClient) => void;
        sdkClientFactory.createSdkClient.mockReturnValue(
          new Promise((resolve) => (resolveClient = resolve)),
        );
        service = createService();
        await settle();

        const unlock = service.unlock(userId, unlockRequest);
        await service.lock(userId);
        expect(unlockClient.lock).not.toHaveBeenCalled();
        resolveClient(mockClient);

        await expect(unlock).rejects.toThrow("locked while unlocking");
        expect(crypto.initialize_user_crypto).not.toHaveBeenCalled();
        expect(unlockClient.lock).not.toHaveBeenCalled();
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("never initializes the user crypto for an unlock that a lock already overtook", async () => {
        service = createService();
        await settle();
        const kdfConfig$ = new Subject<PBKDF2KdfConfig>();
        kdfConfigService.getKdfConfig$
          .mockReturnValueOnce(kdfConfig$)
          .mockReturnValue(of(PBKDF2KdfConfig.createDefault()));

        const unlock = service.unlock(userId, unlockRequest);
        await settle();
        await service.lock(userId);
        kdfConfig$.next(PBKDF2KdfConfig.createDefault());

        await expect(unlock).rejects.toThrow("locked while unlocking");
        expect(crypto.initialize_user_crypto).not.toHaveBeenCalled();
      });

      it("leaves a newer unlock keyed and ready when an overtaken unlock arrives after it", async () => {
        service = createService();
        await settle();
        const kdfConfig$ = new Subject<PBKDF2KdfConfig>();
        kdfConfigService.getKdfConfig$
          .mockReturnValueOnce(kdfConfig$)
          .mockReturnValue(of(PBKDF2KdfConfig.createDefault()));

        const staleUnlock = service.unlock(userId, unlockRequest);
        await settle();
        await service.lock(userId);
        await expect(service.unlock(userId, unlockRequest)).resolves.toEqual(userKey);
        await service.setOrgKeys(userId, {});
        const clearsBefore = unlockClient.lock.mock.calls.length;

        kdfConfig$.next(PBKDF2KdfConfig.createDefault());
        await expect(staleUnlock).rejects.toThrow("locked while unlocking");

        expect(unlockClient.lock).toHaveBeenCalledTimes(clearsBefore);
        expect(crypto.initialize_user_crypto).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);
      });

      it("clears the client and rejects when a lock lands while organization keys apply", async () => {
        service = createService();
        await service.unlock(userId, unlockRequest);
        const release = holdNext(crypto.initialize_org_crypto);

        const setOrgKeys = service.setOrgKeys(userId, {});
        await settle();
        await service.lock(userId);
        unlockClient.lock.mockClear();
        release();

        await expect(setOrgKeys).rejects.toThrow("locked while applying organization keys");
        expect(unlockClient.lock).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("does not become ready when organization keys arrive after a lock", async () => {
        service = createService();
        await service.unlock(userId, unlockRequest);
        await service.lock(userId);

        await expect(service.setOrgKeys(userId, {})).resolves.toBeUndefined();

        expect(crypto.initialize_org_crypto).not.toHaveBeenCalled();
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("rejects an unlock decided before a logout", async () => {
        service = createService();
        await settle();
        const release = holdNext(crypto.initialize_user_crypto);

        const unlock = service.unlock(userId, unlockRequest);
        await settle();
        service.logout(userId);
        release();

        await expect(unlock).rejects.toThrow("locked while unlocking");
      });

      it("rejects an unlock decided before the access token was removed", async () => {
        service = createService();
        await settle();
        const release = holdNext(crypto.initialize_user_crypto);

        const unlock = service.unlock(userId, unlockRequest);
        await settle();
        hasAccessToken$.next(false);
        await settle();
        release();

        await expect(unlock).rejects.toThrow("locked while unlocking");
      });
    });

    describe("lock", () => {
      it("clears the keys of the same client instance, which unlocks again", async () => {
        await startUnlocked();
        const before = await firstValueFrom(service.userClient$(userId));
        unlockClient.lock.mockClear();
        crypto.initialize_user_crypto.mockClear();

        await service.lock(userId);

        expect(unlockClient.lock).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(service.userClient$(userId))).resolves.toBe(before);

        await expect(service.unlock(userId, unlockRequest)).resolves.toEqual(userKey);
        expect(crypto.initialize_user_crypto).toHaveBeenCalledTimes(1);
        expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
        expect(mockClient.free).not.toHaveBeenCalled();
      });

      it("resolves and logs when clearing the keys fails", async () => {
        await startUnlocked();
        unlockClient.lock.mockRejectedValue(new Error("clear failed"));

        await expect(service.lock(userId)).resolves.toBeUndefined();

        expect(logService.error).toHaveBeenCalled();
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });
    });

    describe("setFlags", () => {
      it("loads the flags into the live client", async () => {
        service = createService();
        await settle();
        const flags = new Map([["flag", true]]);

        await service.setFlags(userId, flags);

        expect(mockClient.platform().load_flags).toHaveBeenCalledWith(flags);
      });
    });

    describe("cryptoReady$", () => {
      it("is false for a token-only client", async () => {
        service = createService();
        await settle();

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("stays false after unlock until the organization keys are applied", async () => {
        service = createService();
        await service.unlock(userId, unlockRequest);

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it.each([
        ["no organization keys", {}],
        [
          "organization keys",
          { [Utils.newGuid() as OrganizationId]: "2.org-key" as UnsignedSharedKey },
        ],
      ])("becomes true once %s are applied", async (_, orgKeys) => {
        service = createService();
        await service.unlock(userId, unlockRequest);

        await service.setOrgKeys(userId, orgKeys);

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);
        const [orgId, key] = Object.entries(orgKeys)[0] ?? [];
        expect(crypto.initialize_org_crypto).toHaveBeenCalledWith({
          organizationKeys: new Map(orgId == null ? [] : [[orgId, key]]),
        });
      });

      it("never emits false when organization keys are applied to a ready client", async () => {
        await startUnlocked();
        const tracker = new ObservableTracker(service.cryptoReady$(userId));

        await service.setOrgKeys(userId, {
          [Utils.newGuid() as OrganizationId]: "2.org-key" as UnsignedSharedKey,
        });
        await service.setOrgKeys(userId, {});

        expect(tracker.emissions).toEqual([true]);
      });

      it("keeps its value when unlock fails before the keys are cleared", async () => {
        await startUnlocked();
        kdfConfigService.getKdfConfig$.calledWith(userId).mockReturnValue(of(null));

        await expect(service.unlock(userId, unlockRequest)).rejects.toThrow();

        expect(unlockClient.lock).not.toHaveBeenCalled();
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);
      });

      it("is false when unlock fails after the keys are cleared", async () => {
        await startUnlocked();
        crypto.initialize_user_crypto.mockRejectedValue(new Error("wrong password"));

        await expect(service.unlock(userId, unlockRequest)).rejects.toThrow("wrong password");

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("becomes false on lock", async () => {
        await startUnlocked();

        await service.lock(userId);

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("becomes false on logout", async () => {
        await startUnlocked();

        service.logout(userId);
        await settle();

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      });

      it("stays false when there is no client to apply the organization keys to", async () => {
        hasAccessToken$.next(false);
        service = createService();

        await service.setOrgKeys(userId, {});

        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
        expect(crypto.initialize_org_crypto).not.toHaveBeenCalled();
      });

      it("stays false after logout while the disposed client is still referenced", async () => {
        service = createService();
        const rc = await firstValueFrom(service.userClient$(userId));
        using ref = rc.take();
        service.logout(userId);
        await settle();

        await service.setOrgKeys(userId, {});

        expect(rc.isMarkedForDisposal).toBe(true);
        expect(ref.value).toBe(mockClient);
        await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
        expect(crypto.initialize_org_crypto).not.toHaveBeenCalled();
      });

      describe("given applying the organization keys fails", () => {
        const orgKeysError = new Error("org keys failed");

        it("locks a client that is finishing an unlock, stays false and rejects", async () => {
          service = createService();
          await service.unlock(userId, unlockRequest);
          unlockClient.lock.mockClear();
          crypto.initialize_org_crypto.mockRejectedValue(orgKeysError);

          await expect(service.setOrgKeys(userId, {})).rejects.toBe(orgKeysError);

          expect(unlockClient.lock).toHaveBeenCalledTimes(1);
          await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
        });

        it("rejects with the original error and logs when locking also fails", async () => {
          service = createService();
          await service.unlock(userId, unlockRequest);
          crypto.initialize_org_crypto.mockRejectedValue(orgKeysError);
          unlockClient.lock.mockRejectedValue(new Error("clear failed"));

          await expect(service.setOrgKeys(userId, {})).rejects.toBe(orgKeysError);

          expect(logService.error).toHaveBeenCalled();
          await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
        });

        it("leaves a ready client unlocked and ready, and rejects", async () => {
          await startUnlocked();
          unlockClient.lock.mockClear();
          crypto.initialize_org_crypto.mockRejectedValue(orgKeysError);
          const tracker = new ObservableTracker(service.cryptoReady$(userId));

          await expect(service.setOrgKeys(userId, {})).rejects.toBe(orgKeysError);

          expect(unlockClient.lock).not.toHaveBeenCalled();
          expect(tracker.emissions).toEqual([true]);
        });
      });
    });

    /** Simulates the rest of logout removing the user's access token. */
    async function logOut(): Promise<void> {
      hasAccessToken$.next(false);
      await settle();
    }
  });
});

function createMockClient(): MockProxy<PasswordManagerClient> {
  const client = mock<PasswordManagerClient>();
  client.crypto.mockReturnValue(mock());
  client.unlock.mockReturnValue(mock<UnlockClient>());
  client.platform.mockReturnValue({
    state: jest.fn().mockReturnValue(mock()),
    load_flags: jest.fn().mockReturnValue(mock()),
    free: mock(),
    [Symbol.dispose]: jest.fn(),
  });
  client.km_state_bridge.mockReturnValue({
    register_bridge_impl: jest.fn(),
    free: mock(),
    [Symbol.dispose]: jest.fn(),
  } as any);
  return client;
}
