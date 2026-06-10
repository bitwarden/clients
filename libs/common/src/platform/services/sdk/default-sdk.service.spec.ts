import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

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
import { EncryptedString } from "../../../key-management/crypto/models/enc-string";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { SdkUnlockData, UserNotLoggedInError } from "../../abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

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
  let userKey: UserKey;

  let service: DefaultSdkService;

  /** Brings the user into `accounts$`, which is what triggers token-only client creation. */
  const login = async () => {
    accounts$.next({ [userId]: mockAccountInfoWith({ email: "email", name: "name" }) });
    await flush();
  };

  const unlockData = (): SdkUnlockData => ({
    userKey,
    email: "email",
    kdf: PBKDF2KdfConfig.createDefault().toSdkConfig(),
    accountCryptographicState: { V1: { private_key: "private-key" as EncryptedString } },
    orgKeys: {},
  });

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

    // Long-lived path is gated on the flag (captured once at startup). Default it ON for these tests.
    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(true as never);

    accountService = mockAccountServiceWith(userId);
    accounts$ = new BehaviorSubject<Record<UserId, AccountInfo>>({});
    accountService.accounts$ = accounts$;
    fakeStateProvider = new FakeStateProvider(accountService);

    userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    jest.spyOn(userKey, "toSdk").mockReturnValue("sdk-user-key" as never);

    service = new DefaultSdkService(
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
    );
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

  it("initializes user and org crypto on the existing client when unlocking (no rebuild)", async () => {
    const client = createMockClient();
    sdkClientFactory.createSdkClient.mockResolvedValue(client);

    await login();
    await service.unlock(userId, unlockData());

    expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
    expect(client.crypto().initialize_user_crypto).toHaveBeenCalledTimes(1);
    expect(client.crypto().initialize_org_crypto).toHaveBeenCalledTimes(1);
  });

  it("reuses the same client across many operations without rebuilding it", async () => {
    const client = createMockClient();
    sdkClientFactory.createSdkClient.mockResolvedValue(client);

    await login();
    await service.unlock(userId, unlockData());
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

  it("applies org keys only while unlocked", async () => {
    const client = createMockClient();
    sdkClientFactory.createSdkClient.mockResolvedValue(client);
    await login();

    // Locked: org crypto cannot be initialized yet.
    await service.setOrgKeys(userId, {});
    expect(client.crypto().initialize_org_crypto).not.toHaveBeenCalled();

    await service.unlock(userId, unlockData()); // initialize_org_crypto #1
    await service.setOrgKeys(userId, {}); // initialize_org_crypto #2
    expect(client.crypto().initialize_org_crypto).toHaveBeenCalledTimes(2);
  });

  it("disposes the unlocked client on lock and emits a fresh key-cleared client", async () => {
    const unlockedClient = createMockClient();
    const lockedClient = createMockClient();
    sdkClientFactory.createSdkClient
      .mockResolvedValueOnce(unlockedClient)
      .mockResolvedValueOnce(lockedClient);

    await login(); // builds unlockedClient (token-only)
    await service.unlock(userId, unlockData()); // crypto on unlockedClient
    await service.lock(userId); // builds lockedClient, disposes unlockedClient

    expect(unlockedClient.free).toHaveBeenCalledTimes(1);
    expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(2);

    const rc = await firstValueFrom(service.userClient$(userId));
    expect(rc.take().value).toBe(lockedClient);
    expect(lockedClient.crypto().initialize_user_crypto).not.toHaveBeenCalled();
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
    await expect(firstValueFrom(service.userClient$(userId))).rejects.toThrow(UserNotLoggedInError);
  });
});

function createMockClient(): MockProxy<PasswordManagerClient> {
  const client = mock<PasswordManagerClient>();
  client.crypto.mockReturnValue(mock());
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
  return client;
}
