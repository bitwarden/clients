import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, throwError } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptedString, PBKDF2KdfConfig, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { InitUserCryptoRequest, PasswordManagerClient } from "@bitwarden/sdk-internal";

import {
  ObservableTracker,
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
  mockAccountInfoWith,
} from "../../../../spec";
import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo } from "../../../auth/abstractions/account.service";
import { AccountCryptographicStateService } from "../../../key-management/account-cryptography/account-cryptographic-state.service";
import { V2UpgradeTokenStateService } from "../../../key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { asUuid, UserNotLoggedInError } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";

import { DefaultSdkService } from "./default-sdk.service";

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    return Promise.resolve();
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise(process.nextTick);
  }
};

describe("DefaultSdkService", () => {
  const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;

  let sdkClientFactory: MockProxy<SdkClientFactory>;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let accountService: FakeAccountService;
  let accounts$: BehaviorSubject<Record<UserId, AccountInfo>>;
  let fakeStateProvider: FakeStateProvider;
  let apiService: MockProxy<ApiService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let keyService: MockProxy<KeyService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;
  let configService: MockProxy<ConfigService>;
  let upgradeTokenStateService: MockProxy<V2UpgradeTokenStateService>;
  let userKey: UserKey;

  let service: DefaultSdkService;

  /** Brings the user into `accounts$`, which is what triggers token-only client creation. */
  const login = async () => {
    accounts$.next({ [userId]: mockAccountInfoWith({ email: "email", name: "name" }) });
    await flush();
  };

  /** A request for the already-derived-key path, as `KeyService.buildSdkUnlockData` produces. */
  const decryptedKeyRequest = (): InitUserCryptoRequest => ({
    userId: asUuid(userId),
    email: "email",
    method: { decryptedKey: { decrypted_user_key: userKey.toSdk() } },
    kdfParams: PBKDF2KdfConfig.createDefault().toSdkConfig(),
    accountCryptographicState: { V1: { private_key: "private-key" as EncryptedString } },
  });

  /** A request for a credential path, where the client derives the key itself. */
  const credentialRequest = (): InitUserCryptoRequest =>
    ({
      ...decryptedKeyRequest(),
      method: { masterPasswordUnlock: {} },
    }) as unknown as InitUserCryptoRequest;

  beforeEach(async () => {
    await new TestSdkLoadService().loadAndInit();

    sdkClientFactory = mock<SdkClientFactory>();
    environmentService = mock<EnvironmentService>();
    environmentService.environment$ = new BehaviorSubject(mock<Environment>());
    environmentService.getEnvironment$
      .calledWith(userId)
      .mockReturnValue(new BehaviorSubject(mock<Environment>()));

    platformUtilsService = mock<PlatformUtilsService>();
    apiService = mock<ApiService>();
    kdfConfigService = mock<KdfConfigService>();
    keyService = mock<KeyService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    upgradeTokenStateService = mock<V2UpgradeTokenStateService>();

    configService = mock<ConfigService>();
    configService.serverConfig$ = new BehaviorSubject(null);

    accountService = mockAccountServiceWith(userId);
    accounts$ = new BehaviorSubject<Record<UserId, AccountInfo>>({});
    accountService.accounts$ = accounts$;
    fakeStateProvider = new FakeStateProvider(accountService);

    userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    jest.spyOn(userKey, "toSdk").mockReturnValue("sdk-user-key" as never);
  });

  /**
   * Constructed per describe rather than in the shared setup: the flag is captured on first use (the
   * `accounts$` subscription resolves it one microtask after construction), so it has to be stubbed
   * before the instance exists.
   */
  const createService = () =>
    new DefaultSdkService(
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
    );

  describe("long-lived path (flag on)", () => {
    beforeEach(() => {
      configService.userCachedFeatureFlag$.mockReturnValue(of(true) as never);
      upgradeTokenStateService.v2UpgradeToken$.calledWith(userId).mockReturnValue(of(null));
      // `unlock` resolves the KDF config itself now, so it has to be present for an unlock to reach
      // `initialize_user_crypto`. The email comes from `accounts$`, which `login()` populates.
      kdfConfigService.getKdfConfig$
        .calledWith(userId)
        .mockReturnValue(of(PBKDF2KdfConfig.createDefault()));
      service = createService();
    });

    it("completes with UserNotLoggedInError when the user is not logged in", async () => {
      const result = firstValueFrom(service.userClient$(userId));

      await expect(result).rejects.toThrow(UserNotLoggedInError);
    });

    it("creates a token-only client when the account appears, without initializing crypto", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      await login();

      const rc = await firstValueFrom(service.userClient$(userId));
      expect(rc.take().value).toBe(client);
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
      expect(client.crypto().initialize_user_crypto).not.toHaveBeenCalled();
    });

    it("initializes user crypto on the existing client when unlocking (no rebuild)", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      await login();
      await service.unlock(userId, decryptedKeyRequest());

      // Mutated in place: the same client is cleared and re-initialized, never rebuilt. Org crypto is not
      // part of unlock; it arrives through setOrgKeys.
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
      expect(client.unlock().lock).toHaveBeenCalledTimes(1);
      expect(client.crypto().initialize_user_crypto).toHaveBeenCalledTimes(1);
      expect(client.crypto().initialize_org_crypto).not.toHaveBeenCalled();
    });

    it("passes the V2 upgrade token when unlocking", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);
      upgradeTokenStateService.v2UpgradeToken$
        .calledWith(userId)
        .mockReturnValue(of("upgrade-token" as never));

      await login();
      await service.unlock(userId, decryptedKeyRequest());

      expect(client.crypto().initialize_user_crypto).toHaveBeenCalledWith(
        expect.objectContaining({ upgradeToken: "upgrade-token" }),
      );
    });

    it("reuses the same client across many operations without rebuilding it", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      await login();
      await service.unlock(userId, decryptedKeyRequest());
      for (let i = 0; i < 5; i++) {
        const rc = await firstValueFrom(service.userClient$(userId));
        expect(rc.take().value).toBe(client);
      }

      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
    });

    it("does not dispose the client when subscriptions drop", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);
      await login();

      const subscription = service.userClient$(userId).subscribe();
      subscription.unsubscribe();
      await flush();

      expect(client.free).not.toHaveBeenCalled();
    });

    it("applies feature flags to the existing client without rebuilding it", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);
      await login();

      await service.setFlags(userId, new Map([["a-flag", true]]));

      const loadFlags = client.platform().load_flags as unknown as jest.Mock;
      expect(loadFlags).toHaveBeenCalledWith(new Map([["a-flag", true]]));
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
    });

    it("pushes org keys to the live client via initialize_org_crypto", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);
      await login();

      await service.unlock(userId, decryptedKeyRequest()); // clear + user crypto
      await service.setOrgKeys(userId, {}); // completes the unlock
      expect(client.crypto().initialize_user_crypto).toHaveBeenCalledTimes(1);
      expect(client.crypto().initialize_org_crypto).toHaveBeenCalledTimes(1);
    });

    describe("cryptoReady$", () => {
      const ready = () => firstValueFrom(service.cryptoReady$(userId));

      it("is false for a token-only client, which cannot decrypt anything", async () => {
        sdkClientFactory.createSdkClient.mockResolvedValue(createMockClient());
        await login();

        await expect(ready()).resolves.toBe(false);
      });

      it("stays false after unlock alone; only setOrgKeys completes it", async () => {
        sdkClientFactory.createSdkClient.mockResolvedValue(createMockClient());
        await login();

        await service.unlock(userId, credentialRequest());
        await expect(ready()).resolves.toBe(false);

        await service.setOrgKeys(userId, {});
        await expect(ready()).resolves.toBe(true);
      });

      it("completes on an empty org-key push, for a user with no organizations", async () => {
        sdkClientFactory.createSdkClient.mockResolvedValue(createMockClient());
        await login();

        await service.unlock(userId, decryptedKeyRequest());
        await service.setOrgKeys(userId, {});

        await expect(ready()).resolves.toBe(true);
      });

      it("goes false again on lock", async () => {
        sdkClientFactory.createSdkClient.mockResolvedValue(createMockClient());
        await login();
        await service.unlock(userId, decryptedKeyRequest());
        await service.setOrgKeys(userId, {});

        await service.lock(userId);

        await expect(ready()).resolves.toBe(false);
      });

      it("stays false when there is no client to push org keys to", async () => {
        // No login, so no client was ever built. `withClient` no-ops, and the readiness flip sits inside it,
        // so the service must not claim keys it never applied.
        await service.setOrgKeys(userId, {});

        await expect(ready()).resolves.toBe(false);
      });

      it("stays false when initialize_org_crypto rejects, and surfaces the rejection", async () => {
        const client = createMockClient();
        client.crypto().initialize_org_crypto.mockRejectedValue(new Error("bad org key") as never);
        sdkClientFactory.createSdkClient.mockResolvedValue(client);
        await login();
        await service.unlock(userId, decryptedKeyRequest());

        // The caller driving the unlock owns the failure; readiness must not latch true behind it.
        await expect(service.setOrgKeys(userId, {})).rejects.toThrow("bad org key");
        await expect(ready()).resolves.toBe(false);
      });
    });

    it("clears the key in place on lock, keeping the same client", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      await login();
      await service.unlock(userId, decryptedKeyRequest());
      await service.lock(userId);

      expect(client.unlock().lock).toHaveBeenCalledTimes(2); // once to clear for the unlock, once to lock
      expect(client.free).not.toHaveBeenCalled();
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);

      const rc = await firstValueFrom(service.userClient$(userId));
      expect(rc.take().value).toBe(client);
    });

    it("throws when there is no client to unlock, since null means flag-off only", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      // Not logged in, so `ensureClient` frees the client it builds rather than publishing it. Returning
      // null here would send a credential caller down the register-client fallback instead.
      await expect(service.unlock(userId, credentialRequest())).rejects.toThrow(
        "Failed to unlock the SDK client",
      );
    });

    it("disposes the client and completes userClient$ on logout", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);
      await login();

      const tracker = new ObservableTracker(service.userClient$(userId), false);
      await tracker.pauseUntilReceived(1);

      service.logout(userId); // dispose
      accounts$.next({}); // account leaves accounts$ → userClient$ completes
      await tracker.expectCompletion();

      expect(client.free).toHaveBeenCalledTimes(1);
    });

    it("frees (does not republish) a client whose build completes after the user logs out", async () => {
      const client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      // Start the build (account appears) but log out before it resolves.
      accounts$.next({ [userId]: mockAccountInfoWith({ email: "email", name: "name" }) });
      service.logout(userId);
      accounts$.next({});
      await flush();

      expect(client.free).toHaveBeenCalled();
      await expect(firstValueFrom(service.userClient$(userId))).rejects.toThrow(
        UserNotLoggedInError,
      );
    });
  });

  // The flag-off path is the default and the rollback target, so it keeps its own coverage until the
  // reactive branch is deleted (PM-31845 cleanup). These are the pre-PM-31845 tests, unchanged apart
  // from the flag stub; the `setClient` override tests are gone with `setClient` itself.
  describe("legacy reactive path (flag off)", () => {
    let client: MockClient;
    let userKey$: BehaviorSubject<UserKey | null>;
    let env$: BehaviorSubject<Environment | undefined>;

    beforeEach(() => {
      configService.userCachedFeatureFlag$.mockReturnValue(of(false) as never);

      env$ = new BehaviorSubject<Environment | undefined>(mock<Environment>());
      environmentService.getEnvironment$
        .calledWith(userId)
        .mockReturnValue(env$ as BehaviorSubject<Environment>);

      accounts$.next({ [userId]: mockAccountInfoWith({ email: "email", name: "name" }) });
      kdfConfigService.getKdfConfig$
        .calledWith(userId)
        .mockReturnValue(of(PBKDF2KdfConfig.createDefault()));
      userKey$ = new BehaviorSubject<UserKey | null>(userKey);
      keyService.userKey$.calledWith(userId).mockReturnValue(userKey$);
      keyService.encryptedOrgKeys$.calledWith(userId).mockReturnValue(of({}));
      accountCryptographicStateService.accountCryptographicState$
        .calledWith(userId)
        .mockReturnValue(of({ V1: { private_key: "private-key" as EncryptedString } }));
      upgradeTokenStateService.v2UpgradeToken$.calledWith(userId).mockReturnValue(of(null));

      client = createMockClient();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      service = createService();
    });

    it("does not create clients from accounts$", async () => {
      await flush();

      expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
    });

    it("does not touch any client when a push method is called", async () => {
      await service.unlock(userId, decryptedKeyRequest());
      await service.setFlags(userId, new Map([["a-flag", true]]));
      await service.setOrgKeys(userId, {});
      await service.lock(userId);
      service.logout(userId);
      await flush();

      expect(sdkClientFactory.createSdkClient).not.toHaveBeenCalled();
    });

    it("reports crypto as always ready, since there is no push window to gate", async () => {
      // The reactive client is rebuilt from the same state the consumers read, so gating on readiness
      // here would only delay them behind a client that is already in step.
      await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(true);
    });

    it("returns null from unlock so a credential caller falls back to the register client", async () => {
      await expect(service.unlock(userId, credentialRequest())).resolves.toBeNull();
    });

    it("creates an internal SDK client when called the first time", async () => {
      await firstValueFrom(service.userClient$(userId));

      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
    });

    it("does not create an SDK client when called the second time with same userId", async () => {
      const subject_1 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);
      const subject_2 = new BehaviorSubject<Rc<PasswordManagerClient> | undefined>(undefined);

      // Use subjects to ensure the subscription is kept alive
      service.userClient$(userId).subscribe(subject_1);
      service.userClient$(userId).subscribe(subject_2);
      await flush();

      expect(subject_1.value!.take().value).toBe(client);
      expect(subject_2.value!.take().value).toBe(client);
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
    });

    it("destroys the internal SDK client when all subscriptions are closed", async () => {
      jest.useFakeTimers();
      const subscription_1 = service.userClient$(userId).subscribe();
      const subscription_2 = service.userClient$(userId).subscribe();
      await jest.advanceTimersByTimeAsync(0);

      subscription_1.unsubscribe();
      subscription_2.unsubscribe();

      await jest.advanceTimersByTimeAsync(0);
      expect(client.free).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1000);
      expect(client.free).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it("does not destroy the internal SDK client if resubscribed within 1 second", async () => {
      jest.useFakeTimers();
      const subscription_1 = service.userClient$(userId).subscribe();
      await jest.advanceTimersByTimeAsync(0);

      subscription_1.unsubscribe();
      await jest.advanceTimersByTimeAsync(500);
      expect(client.free).not.toHaveBeenCalled();

      // Resubscribe before the 1 second delay
      const subscription_2 = service.userClient$(userId).subscribe();
      await jest.advanceTimersByTimeAsync(1000);

      expect(client.free).not.toHaveBeenCalled();
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
      subscription_2.unsubscribe();
      jest.useRealTimers();
    });

    it("emits a new locked client and frees the previous unlocked client when the userKey is unset", async () => {
      const tracker = new ObservableTracker(service.userClient$(userId), false);
      await tracker.pauseUntilReceived(1, 200);

      userKey$.next(null);
      await tracker.pauseUntilReceived(2);

      expect(client.free).toHaveBeenCalledTimes(1);
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(2);
      expect(tracker.emissions[1]).toBeDefined();
    });

    it("completes the subscription and frees the internal SDK client when the environment is unset (logout)", async () => {
      const tracker = new ObservableTracker(service.userClient$(userId), false);
      await tracker.pauseUntilReceived(1);

      env$.next(undefined);
      await tracker.expectCompletion();

      expect(client.free).toHaveBeenCalledTimes(1);
    });

    it("falls back to this path when the flag lookup fails", async () => {
      configService.userCachedFeatureFlag$.mockReturnValue(
        throwError(() => new Error("config unavailable")) as never,
      );
      service = createService();

      const rc = await firstValueFrom(service.userClient$(userId));

      expect(rc.take().value).toBe(client);
    });
  });
});

/** What a real client reports after unlocking: the key it is now unlocked with, as B64. */
const UNLOCKED_KEY_B64 = Buffer.from(new Uint8Array(64)).toString("base64");

type MockCryptoClient = MockProxy<ReturnType<PasswordManagerClient["crypto"]>>;
type MockUnlockClient = MockProxy<ReturnType<PasswordManagerClient["unlock"]>>;

/**
 * `crypto()` and `unlock()` are declared as returning the real subclients, so the assertions below
 * would not see their methods as jest mocks without this.
 */
type MockClient = Omit<MockProxy<PasswordManagerClient>, "crypto" | "unlock"> & {
  crypto: jest.Mock<MockCryptoClient, []>;
  unlock: jest.Mock<MockUnlockClient, []>;
};

function createMockClient(): MockClient {
  const client = mock<PasswordManagerClient>();
  const crypto = mock<ReturnType<PasswordManagerClient["crypto"]>>();
  crypto.get_user_encryption_key.mockResolvedValue(UNLOCKED_KEY_B64 as never);
  client.crypto.mockReturnValue(crypto);
  client.unlock.mockReturnValue(mock<ReturnType<PasswordManagerClient["unlock"]>>());
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
  } as never);
  return client as unknown as MockClient;
}
