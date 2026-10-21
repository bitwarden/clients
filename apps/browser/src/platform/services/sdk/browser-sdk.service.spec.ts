import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, defer, firstValueFrom, of, Subject, Subscription } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { SdkUnlockRequest } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Message, MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService, SdkUnlockData } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import {
  CryptoClient,
  ManagedSettingsClient,
  PasswordManagerClient,
  UnlockClient,
  UnsignedSharedKey,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { stampWebExtSender } from "../../utils/web-ext-sender";

import { BrowserSdkService, SDK_PUSH, SdkPush, SdkPushMessage } from "./browser-sdk.service";

const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;
const orgId = "8f2a7c1e-3b4d-4e5f-9a6b-7c8d9e0f1a2b" as OrganizationId;
const userKey = new SymmetricCryptoKey(new Uint8Array(64).fill(7)) as UserKey;
const orgKeys = { [orgId]: "4.encapsulated-org-key" as UnsignedSharedKey };
const extensionPage = {
  url: "chrome-extension://id/popup/index.html",
} as chrome.runtime.MessageSender;

type Inbox = Subject<Message<Record<string, unknown>>>;

/** `chrome.runtime` messaging between the processes of a test. */
class FakeRuntime {
  private readonly inboxes: Inbox[] = [];

  connect(inbox: Inbox) {
    this.inboxes.push(inbox);
  }

  /**
   * Delivers like `chrome.runtime`: asynchronously, JSON-serialized, stamped with the browser's
   * sender, and to every process except the sending one.
   */
  deliver(payload: Record<string, unknown>, sender = extensionPage, except?: Inbox) {
    for (const inbox of this.inboxes.filter((i) => i !== except)) {
      const message = JSON.parse(JSON.stringify(payload));
      setTimeout(() => inbox.next(stampWebExtSender(message, sender)), 0);
    }
  }

  /** A message from inside one process, which the browser does not stamp. */
  deliverUnstamped(payload: Record<string, unknown>) {
    this.inboxes.forEach((inbox) => inbox.next(payload as Message<Record<string, unknown>>));
  }
}

type Process = {
  service: BrowserSdkService;
  keyService: MockProxy<KeyService>;
  logService: MockProxy<LogService>;
  sent: SdkPushMessage[];
};

describe("BrowserSdkService", () => {
  let runtime: FakeRuntime;
  let userKey$: BehaviorSubject<UserKey | null>;
  let serverConfig$: BehaviorSubject<ServerConfig | null>;
  let subscriptions: Subscription[];

  let superUnlock: jest.SpyInstance;
  let superUnlockAtEpoch: jest.SpyInstance;
  let superLock: jest.SpyInstance;
  let superLogout: jest.SpyInstance;
  let superSetFlags: jest.SpyInstance;
  let superSetOrgKeys: jest.SpyInstance;
  let cryptoReady: jest.SpyInstance;

  const unlockRequest: SdkUnlockRequest = {
    userId: userId as any,
    method: { masterPasswordUnlock: { password: "password" } as any },
    accountCryptographicState: mock<WrappedAccountCryptographicState>(),
  };
  const unlockData: SdkUnlockData = {
    request: {
      userId: userId as any,
      method: { decryptedKey: { decrypted_user_key: userKey.toSdk() } },
      accountCryptographicState: { V1: { private_key: "2.private-key" } } as any,
    },
    orgKeys,
  };

  /** Lets queued pushes and converge settle. */
  const settle = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  function createProcess(): Process {
    const keyService = mock<KeyService>();
    keyService.userKey$.mockReturnValue(userKey$);
    keyService.buildSdkUnlockData.mockResolvedValue(unlockData);

    const configService = mock<ConfigService>();

    const tokenService = mock<TokenService>();
    tokenService.hasAccessToken$.mockReturnValue(of(false));

    const stateProvider = mock<StateProvider>();
    stateProvider.getUser.mockReturnValue({ state$: serverConfig$ } as any);

    const accountService = mock<AccountService>();
    accountService.accounts$ = of({ [userId]: { email: "email" } as any });

    const logService = mock<LogService>();
    const inbox: Inbox = new Subject();
    runtime.connect(inbox);
    const sent: SdkPushMessage[] = [];
    const messageSender = mock<MessageSender>();
    messageSender.send.mockImplementation((command: any, payload: any) => {
      sent.push(payload);
      // Delivered within this process unstamped, and to the other processes through the runtime.
      inbox.next({ ...payload, command: command.command });
      runtime.deliver({ ...payload, command: command.command }, extensionPage, inbox);
    });

    const environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of();

    const service = new BrowserSdkService(
      mock<SdkClientFactory>(),
      environmentService,
      mock<PlatformUtilsService>(),
      accountService,
      () => mock<KdfConfigService>(),
      () => keyService,
      () => mock<ApiService>(),
      stateProvider,
      () => configService,
      mock<V2UpgradeTokenStateService>(),
      mock<ManagedSettingsService>(),
      mock<AppIdService>(),
      logService,
      () => tokenService,
      messageSender,
      new MessageListener(inbox),
    );
    return { service, keyService, logService, sent };
  }

  const lockEpochOf = (process: Process): number => (process.service as any).lockEpoch(userId);

  function start(process: Process): Process {
    subscriptions.push(process.service.init());
    return process;
  }

  beforeEach(() => {
    runtime = new FakeRuntime();
    userKey$ = new BehaviorSubject<UserKey | null>(null);
    serverConfig$ = new BehaviorSubject<ServerConfig | null>(null);
    subscriptions = [];

    superUnlock = jest.spyOn(DefaultSdkService.prototype, "unlock").mockResolvedValue(userKey);
    superUnlockAtEpoch = jest
      .spyOn(DefaultSdkService.prototype as any, "unlockAtEpoch")
      .mockResolvedValue(userKey);
    // Readiness per process: organization keys make a client ready, a lock clears it.
    const ready = new Set<unknown>();
    superLock = jest.spyOn(DefaultSdkService.prototype, "lock").mockImplementation(async function (
      this: unknown,
    ) {
      ready.delete(this);
    });
    superLogout = jest.spyOn(DefaultSdkService.prototype, "logout").mockReturnValue();
    superSetFlags = jest.spyOn(DefaultSdkService.prototype, "setFlags").mockResolvedValue();
    superSetOrgKeys = jest
      .spyOn(DefaultSdkService.prototype, "setOrgKeys")
      .mockImplementation(async function (this: unknown) {
        ready.add(this);
      });
    cryptoReady = jest
      .spyOn(DefaultSdkService.prototype, "cryptoReady$")
      .mockImplementation(function (this: unknown) {
        return of(ready.has(this));
      });
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    jest.restoreAllMocks();
  });

  describe("local pushes", () => {
    it.each<
      [
        string,
        (service: BrowserSdkService) => unknown,
        jest.SpyInstance | (() => jest.SpyInstance),
        SdkPush,
      ]
    >([
      ["lock", (s) => s.lock(userId), () => superLock, { kind: "lock", userId }],
      ["logout", (s) => s.logout(userId), () => superLogout, { kind: "logout", userId }],
      [
        "setFlags",
        (s) => s.setFlags(userId, new Map([["flag", true]])),
        () => superSetFlags,
        { kind: "flags", userId, entries: [["flag", true]] },
      ],
      [
        "setOrgKeys",
        (s) => s.setOrgKeys(userId, orgKeys),
        () => superSetOrgKeys,
        { kind: "orgKeys", userId, orgKeys },
      ],
    ])(
      "applies %s through super, then broadcasts it with this process's origin",
      async (_, push, superSpy, expected) => {
        const process = createProcess();

        await push(process.service);
        await settle();

        expect((superSpy as () => jest.SpyInstance)()).toHaveBeenCalledTimes(1);
        expect(process.sent).toHaveLength(1);
        expect(process.sent[0].push).toEqual(expected);
        expect(typeof process.sent[0].origin).toBe("string");
      },
    );

    it("broadcasts an unlock as the user key it unlocked with, never the unlock method", async () => {
      const process = createProcess();

      await expect(process.service.unlock(userId, unlockRequest)).resolves.toBe(userKey);

      expect(superUnlock).toHaveBeenCalledWith(userId, unlockRequest);
      expect(process.sent.map((m) => m.push)).toEqual([
        { kind: "unlock", userId, userKeyB64: userKey.toBase64() },
      ]);
      expect(JSON.stringify(process.sent)).not.toContain("password");
    });

    it("does not broadcast an unlock that failed", async () => {
      superUnlock.mockRejectedValue(new Error("wrong password"));
      const process = createProcess();

      await expect(process.service.unlock(userId, unlockRequest)).rejects.toThrow("wrong password");

      expect(process.sent).toHaveLength(0);
    });

    it("calls super.logout synchronously", () => {
      const process = createProcess();

      process.service.logout(userId);

      expect(superLogout).toHaveBeenCalledWith(userId);
    });

    it("does not broadcast organization keys that failed to apply on a ready client", async () => {
      superSetOrgKeys.mockRejectedValue(new Error("org keys failed"));
      cryptoReady.mockReturnValue(of(true));
      const process = createProcess();

      await expect(process.service.setOrgKeys(userId, orgKeys)).rejects.toThrow("org keys failed");

      expect(process.sent).toHaveLength(0);
    });

    it("broadcasts a lock, then rethrows, when organization keys fail on a client finishing an unlock", async () => {
      const error = new Error("org keys failed");
      superSetOrgKeys.mockRejectedValue(error);
      const process = createProcess();

      await expect(process.service.setOrgKeys(userId, orgKeys)).rejects.toBe(error);

      expect(process.sent.map((m) => m.push)).toEqual([{ kind: "lock", userId }]);
    });

    it("rethrows the original error and logs when the lock broadcast throws", async () => {
      const error = new Error("org keys failed");
      superSetOrgKeys.mockRejectedValue(error);
      const process = createProcess();
      (process.service as any).messageSender.send.mockImplementation(() => {
        throw new Error("context invalidated");
      });

      await expect(process.service.setOrgKeys(userId, orgKeys)).rejects.toBe(error);

      expect(process.logService.error).toHaveBeenCalled();
    });

    it("resolves lock and logs when broadcasting throws", async () => {
      const process = createProcess();
      (process.service as any).messageSender.send.mockImplementation(() => {
        throw new Error("context invalidated");
      });

      await expect(process.service.lock(userId)).resolves.toBeUndefined();

      expect(process.logService.error).toHaveBeenCalled();
    });
  });

  describe("remote pushes", () => {
    it("ignores its own broadcast when it arrives back", async () => {
      const process = start(createProcess());
      await settle();
      superLock.mockClear();

      await process.service.lock(userId);
      await settle();

      expect(superLock).toHaveBeenCalledTimes(1);
      expect(process.sent).toHaveLength(1);
    });

    it("ignores its own broadcast even when the browser delivers it back stamped", async () => {
      const process = start(createProcess());
      await settle();
      await process.service.lock(userId);
      superLock.mockClear();

      runtime.deliver({ command: SDK_PUSH.command, ...process.sent[0] });
      await settle();

      expect(superLock).not.toHaveBeenCalled();
    });

    it("applies the other process's push through super without broadcasting it again", async () => {
      const background = start(createProcess());
      const popup = createProcess();
      await settle();

      await popup.service.lock(userId);
      await settle();

      expect(superLock).toHaveBeenCalledTimes(2);
      expect(superLock.mock.contexts).toEqual([popup.service, background.service]);
      expect(background.sent).toHaveLength(0);
    });

    it.each<[string, SdkPush, () => void]>([
      ["lock", { kind: "lock", userId }, () => expect(superLock).toHaveBeenCalledWith(userId)],
      [
        "logout",
        { kind: "logout", userId },
        () => expect(superLogout).toHaveBeenCalledWith(userId),
      ],
      [
        "flags",
        {
          kind: "flags",
          userId,
          entries: [
            ["flag", true],
            ["other", false],
          ],
        },
        () =>
          expect(superSetFlags).toHaveBeenCalledWith(
            userId,
            new Map([
              ["flag", true],
              ["other", false],
            ]),
          ),
      ],
      [
        "orgKeys",
        { kind: "orgKeys", userId, orgKeys },
        () => expect(superSetOrgKeys).toHaveBeenCalledWith(userId, orgKeys),
      ],
    ])("rebuilds a remote %s push after JSON serialization", async (_, push, verify) => {
      const process = start(createProcess());
      await settle();
      jest.clearAllMocks();
      cryptoReady.mockReturnValue(of(true));

      runtime.deliver({ command: SDK_PUSH.command, origin: "other-process", push });
      await settle();

      verify();
      expect(process.sent).toHaveLength(0);
    });

    it("unlocks from a remote user key and applies the organization keys built from state", async () => {
      const process = start(createProcess());
      await settle();
      jest.clearAllMocks();

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other-process",
        push: { kind: "unlock", userId, userKeyB64: userKey.toBase64() },
      });
      await settle();

      expect(process.keyService.buildSdkUnlockData).toHaveBeenCalledWith(userId, userKey);
      expect(superUnlockAtEpoch).toHaveBeenCalledWith(
        userId,
        unlockData.request,
        lockEpochOf(process),
      );
      expect(superSetOrgKeys).toHaveBeenCalledWith(userId, orgKeys);
      expect(superUnlockAtEpoch.mock.invocationCallOrder[0]).toBeLessThan(
        superSetOrgKeys.mock.invocationCallOrder[0],
      );
      expect(process.sent).toHaveLength(0);
    });

    it("leaves a ready client alone on a remote unlock", async () => {
      start(createProcess());
      await settle();
      jest.clearAllMocks();
      cryptoReady.mockReturnValue(of(true));

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other-process",
        push: { kind: "unlock", userId, userKeyB64: userKey.toBase64() },
      });
      await settle();

      expect(superUnlockAtEpoch).not.toHaveBeenCalled();
    });

    it("skips remote organization keys while this process's client is not ready", async () => {
      start(createProcess());
      await settle();
      jest.clearAllMocks();

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other-process",
        push: { kind: "orgKeys", userId, orgKeys },
      });
      await settle();

      expect(superSetOrgKeys).not.toHaveBeenCalled();
    });

    it("broadcasts a lock when a remote unlock fails closed on organization keys", async () => {
      const process = start(createProcess());
      await settle();
      jest.clearAllMocks();
      superSetOrgKeys.mockRejectedValue(new Error("org keys failed"));

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other-process",
        push: { kind: "unlock", userId, userKeyB64: userKey.toBase64() },
      });
      await settle();

      expect(process.sent.map((m) => m.push)).toEqual([{ kind: "lock", userId }]);
      expect(process.logService.error).toHaveBeenCalled();
    });

    it("unlocks at the lock epoch from before it used the pushed key", async () => {
      const process = start(createProcess());
      await settle();
      jest.clearAllMocks();
      let releaseUnlockData!: () => void;
      process.keyService.buildSdkUnlockData.mockImplementationOnce(
        () => new Promise((resolve) => (releaseUnlockData = () => resolve(unlockData))),
      );
      const epochAtDelivery = lockEpochOf(process);

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other-process",
        push: { kind: "unlock", userId, userKeyB64: userKey.toBase64() },
      });
      await settle();
      // A lock lands while the unlock data is being built from the pushed key.
      (process.service as any).bumpLockEpoch(userId);
      releaseUnlockData();
      await settle();

      expect(superUnlockAtEpoch).toHaveBeenCalledWith(userId, unlockData.request, epochAtDelivery);
    });

    it("ignores pushes from content scripts", async () => {
      start(createProcess());
      await settle();
      jest.clearAllMocks();

      runtime.deliver(
        { command: SDK_PUSH.command, origin: "page", push: { kind: "orgKeys", userId, orgKeys } },
        { url: "https://evil.example/", tab: { id: 1 } } as chrome.runtime.MessageSender,
      );
      runtime.deliverUnstamped({
        command: SDK_PUSH.command,
        origin: "unstamped",
        push: { kind: "lock", userId },
      });
      await settle();

      expect(superSetOrgKeys).not.toHaveBeenCalled();
      expect(superLock).not.toHaveBeenCalled();
    });

    it("logs and keeps applying later pushes when one fails", async () => {
      const process = start(createProcess());
      await settle();
      jest.clearAllMocks();
      cryptoReady.mockReturnValue(of(true));
      superLock.mockRejectedValueOnce(new Error("lock failed"));

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other",
        push: { kind: "lock", userId },
      });
      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other",
        push: { kind: "orgKeys", userId, orgKeys },
      });
      await settle();

      expect(process.logService.error).toHaveBeenCalled();
      expect(superSetOrgKeys).toHaveBeenCalledWith(userId, orgKeys);
    });
  });

  describe("converge", () => {
    it("unlocks an unlocked user's client from shared state when the process starts", async () => {
      userKey$.next(userKey);
      const process = start(createProcess());
      await settle();

      expect(process.keyService.buildSdkUnlockData).toHaveBeenCalledWith(userId, userKey);
      expect(superUnlockAtEpoch).toHaveBeenCalledWith(
        userId,
        unlockData.request,
        lockEpochOf(process),
      );
      expect(superSetOrgKeys).toHaveBeenCalledWith(userId, orgKeys);
      expect(process.sent).toHaveLength(0);
    });

    it("leaves a locked user's client locked", async () => {
      start(createProcess());
      await settle();

      expect(superUnlockAtEpoch).not.toHaveBeenCalled();
    });

    it("leaves a ready client alone", async () => {
      userKey$.next(userKey);
      cryptoReady.mockReturnValue(of(true));
      start(createProcess());
      await settle();

      expect(superUnlockAtEpoch).not.toHaveBeenCalled();
    });

    it("broadcasts a lock when converging fails closed on organization keys", async () => {
      userKey$.next(userKey);
      superSetOrgKeys.mockRejectedValue(new Error("org keys failed"));
      const process = start(createProcess());
      await settle();

      expect(process.sent.map((m) => m.push)).toEqual([{ kind: "lock", userId }]);
    });

    it("unlocks at the lock epoch from before it read the user key", async () => {
      const process = createProcess();
      await settle();
      const epochBeforeRead = lockEpochOf(process);
      // A lock lands while the user key is being read.
      process.keyService.userKey$.mockReturnValue(
        defer(() => {
          (process.service as any).bumpLockEpoch(userId);
          return of(userKey);
        }),
      );
      start(process);
      await settle();

      expect(lockEpochOf(process)).toBe(epochBeforeRead + 1);
      expect(superUnlockAtEpoch).toHaveBeenCalledWith(userId, unlockData.request, epochBeforeRead);
    });

    it("loads the user's flags from the stored server config", async () => {
      serverConfig$.next({
        featureStates: { flag: true, other: "text" },
      } as unknown as ServerConfig);
      start(createProcess());
      await settle();

      expect(superSetFlags).toHaveBeenCalledWith(userId, new Map([["flag", true]]));
    });

    it("applies a push that arrives while converging after converging", async () => {
      userKey$.next(userKey);
      let finishUnlock!: () => void;
      superUnlockAtEpoch.mockImplementationOnce(
        () => new Promise((resolve) => (finishUnlock = () => resolve(userKey))),
      );
      start(createProcess());
      await settle();

      runtime.deliver({
        command: SDK_PUSH.command,
        origin: "other",
        push: { kind: "lock", userId },
      });
      await settle();
      expect(superLock).not.toHaveBeenCalled();

      finishUnlock();
      await settle();
      expect(superLock).toHaveBeenCalledTimes(1);
      expect(superLock.mock.invocationCallOrder[0]).toBeGreaterThan(
        superSetOrgKeys.mock.invocationCallOrder[0],
      );
    });
  });

  describe("a vault timeout lock while the woken background converges", () => {
    it("never keys the client or writes the user key back, and ends not ready", async () => {
      jest.restoreAllMocks();
      Object.defineProperty(SdkLoadService, "Ready", {
        value: Promise.resolve(),
        writable: true,
        configurable: true,
      });

      // The SDK writes the user key to state when it initializes the user crypto, and clears it
      // when it locks. Modelled here as one value.
      let stateUserKey: string | null = null;
      const crypto = mock<CryptoClient>();
      crypto.initialize_user_crypto.mockImplementation(async () => {
        stateUserKey = userKey.toBase64();
      });
      crypto.get_user_encryption_key.mockResolvedValue(userKey.toBase64());
      const unlockClient = mock<UnlockClient>();
      unlockClient.lock.mockImplementation(async () => {
        stateUserKey = null;
      });
      const client = mock<PasswordManagerClient>();
      client.crypto.mockReturnValue(crypto);
      client.unlock.mockReturnValue(unlockClient);
      client.platform.mockReturnValue({
        state: jest.fn().mockReturnValue(mock()),
        load_flags: jest.fn(),
      } as any);
      client.km_state_bridge.mockReturnValue({ register_bridge_impl: jest.fn() } as any);

      let resolveClient!: (client: PasswordManagerClient) => void;
      const sdkClientFactory = mock<SdkClientFactory>();
      sdkClientFactory.createSdkClient.mockReturnValue(
        new Promise((resolve) => (resolveClient = resolve)),
      );

      const keyService = mock<KeyService>();
      keyService.userKey$.mockReturnValue(of(userKey)); // Restored from session storage on wake.
      keyService.buildSdkUnlockData.mockResolvedValue(unlockData);
      const configService = mock<ConfigService>();
      configService.serverConfig$ = of(null);
      const tokenService = mock<TokenService>();
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      const environmentService = mock<EnvironmentService>();
      environmentService.environment$ = of();
      // `of(mock())` would treat the mock as a scheduler, see `mockManagedSettingsService`.
      environmentService.getEnvironment$.mockReturnValue(new BehaviorSubject(mock<Environment>()));
      const kdfConfigService = mock<KdfConfigService>();
      kdfConfigService.getKdfConfig$.mockReturnValue(of({ toSdkConfig: () => ({}) } as any));
      const v2UpgradeTokenStateService = mock<V2UpgradeTokenStateService>();
      v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(null));
      const accountService = mock<AccountService>();
      accountService.accounts$ = of({ [userId]: { email: "email" } as any });
      const stateProvider = mock<StateProvider>();
      stateProvider.getUser.mockReturnValue({ state$: of(null) } as any);
      const managedSettingsService = mock<ManagedSettingsService>();
      managedSettingsService.client$ = new BehaviorSubject(mock<ManagedSettingsClient>());
      const logService = mock<LogService>();
      const inbox: Inbox = new Subject();

      const service = new BrowserSdkService(
        sdkClientFactory,
        environmentService,
        mock<PlatformUtilsService>(),
        accountService,
        () => kdfConfigService,
        () => keyService,
        () => mock<ApiService>(),
        stateProvider,
        () => configService,
        v2UpgradeTokenStateService,
        managedSettingsService,
        mock<AppIdService>(),
        logService,
        () => tokenService,
        mock<MessageSender>(),
        new MessageListener(inbox),
      );

      // bootstrap: converge starts, then the vault timeout check locks before the client exists.
      subscriptions.push(service.init());
      await settle();
      await service.lock(userId);
      resolveClient(client);
      await settle();

      expect(crypto.initialize_user_crypto).not.toHaveBeenCalled();
      expect(unlockClient.lock).not.toHaveBeenCalled();
      expect(stateUserKey).toBeNull();
      expect(crypto.initialize_org_crypto).not.toHaveBeenCalled();
      await expect(firstValueFrom(service.cryptoReady$(userId))).resolves.toBe(false);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("across the popup and the background", () => {
    const rotatedUserKey = new SymmetricCryptoKey(new Uint8Array(64).fill(9)) as UserKey;

    it("re-keys the other process's ready client when one process unlocks with a new user key", async () => {
      const background = start(createProcess());
      const popup = start(createProcess());
      await settle();
      await popup.service.unlock(userId, unlockRequest);
      await popup.service.setOrgKeys(userId, orgKeys);
      await settle();
      jest.clearAllMocks();

      // A key rotation in the popup, followed by the re-key with the rotated key.
      superUnlock.mockResolvedValue(rotatedUserKey);
      await popup.service.unlock(userId, unlockRequest);
      await settle();

      expect(superUnlockAtEpoch.mock.contexts).toEqual([background.service]);
      expect(background.keyService.buildSdkUnlockData).toHaveBeenCalledWith(userId, rotatedUserKey);
    });

    it("leaves the other process's ready client alone when the same user key is pushed again", async () => {
      start(createProcess());
      const popup = start(createProcess());
      await settle();
      await popup.service.unlock(userId, unlockRequest);
      await popup.service.setOrgKeys(userId, orgKeys);
      await settle();
      jest.clearAllMocks();

      await popup.service.unlock(userId, unlockRequest);
      await settle();

      expect(superUnlockAtEpoch).not.toHaveBeenCalled();
    });

    it("does not re-key a ready client when converging finds a different key in state", async () => {
      const process = createProcess();
      await process.service.unlock(userId, unlockRequest);
      await process.service.setOrgKeys(userId, orgKeys);
      jest.clearAllMocks();
      userKey$.next(rotatedUserKey);

      start(process);
      await settle();

      expect(superUnlockAtEpoch).not.toHaveBeenCalled();
    });

    it.each(["lock", "logout"] as const)(
      "forgets the applied user key on a local and a remote %s",
      async (kind) => {
        const background = start(createProcess());
        const popup = start(createProcess());
        await settle();
        await popup.service.unlock(userId, unlockRequest);
        await popup.service.setOrgKeys(userId, orgKeys);
        await settle();
        const applied = (process: Process) => (process.service as any).appliedUserKeys.has(userId);
        expect([applied(popup), applied(background)]).toEqual([true, true]);

        if (kind === "lock") {
          await popup.service.lock(userId);
        } else {
          popup.service.logout(userId);
        }
        await settle();

        expect([applied(popup), applied(background)]).toEqual([false, false]);
      },
    );

    it("unlocks the background's client when the popup unlocks", async () => {
      const background = start(createProcess());
      const popup = start(createProcess());
      await settle();
      jest.clearAllMocks();

      await popup.service.unlock(userId, unlockRequest);
      await popup.service.setOrgKeys(userId, orgKeys);
      await settle();

      expect(superUnlock.mock.contexts).toEqual([popup.service]);
      expect(superUnlockAtEpoch.mock.contexts).toEqual([background.service]);
      expect(superUnlockAtEpoch).toHaveBeenCalledWith(
        userId,
        unlockData.request,
        lockEpochOf(background),
      );
      expect(background.keyService.buildSdkUnlockData).toHaveBeenCalledWith(userId, userKey);
      expect(background.sent).toHaveLength(0);
    });

    it("unlocks an open popup's client when the background unlocks with biometrics", async () => {
      const background = start(createProcess());
      const popup = start(createProcess());
      await settle();
      jest.clearAllMocks();

      // The background's unlock pushes, followed by its cross-context unlock announcement.
      await background.service.unlock(userId, unlockRequest);
      await background.service.setOrgKeys(userId, orgKeys);
      runtime.deliver({ command: "backgroundUnlockCompleted", userId });
      await settle();

      expect(superUnlockAtEpoch.mock.contexts).toEqual([popup.service]);
      expect(popup.keyService.buildSdkUnlockData).toHaveBeenCalledWith(userId, userKey);
      expect(superSetOrgKeys.mock.contexts.filter((c) => c === popup.service)).toHaveLength(2);
    });

    it("clears the other process's ready client when one process fails closed on organization keys", async () => {
      const background = start(createProcess());
      const popup = start(createProcess());
      await settle();
      jest.clearAllMocks();
      superSetOrgKeys.mockImplementation(async function (this: BrowserSdkService) {
        if (this === popup.service) {
          throw new Error("org keys failed");
        }
      });

      await expect(popup.service.setOrgKeys(userId, orgKeys)).rejects.toThrow("org keys failed");
      await settle();

      expect(superLock.mock.contexts).toEqual([background.service]);
    });

    it.each(["lock", "logout"] as const)(
      "clears the popup's client when the background pushes a %s",
      async (kind) => {
        const background = start(createProcess());
        const popup = start(createProcess());
        await settle();
        jest.clearAllMocks();

        if (kind === "lock") {
          await background.service.lock(userId);
        } else {
          background.service.logout(userId);
        }
        await settle();

        const spy = kind === "lock" ? superLock : superLogout;
        expect(spy.mock.contexts).toEqual([background.service, popup.service]);
      },
    );
  });
});
