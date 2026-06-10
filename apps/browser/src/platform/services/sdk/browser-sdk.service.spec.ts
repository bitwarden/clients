import { mock, MockProxy } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Message, MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService, SdkUnlockData } from "@bitwarden/key-management";

import { BrowserSdkService } from "./browser-sdk.service";

/** A 64-byte key as B64, matching what a real client reports after unlocking. */
const UNLOCKED_KEY_B64 = Buffer.from(new Uint8Array(64)).toString("base64");

describe("BrowserSdkService", () => {
  const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;

  let messageSender: MockProxy<MessageSender>;
  let messages: Subject<Message<Record<string, unknown>>>;
  let keyService: MockProxy<KeyService>;
  let accountService: MockProxy<AccountService>;
  let stateProvider: MockProxy<StateProvider>;
  let configService: MockProxy<ConfigService>;
  let service: BrowserSdkService;

  /**
   * The flag is captured on first use, one microtask after construction, so a test that wants a
   * different flag value has to restub `userCachedFeatureFlag$` and rebuild.
   */
  let createService: () => BrowserSdkService;

  const unlockData = (): SdkUnlockData => ({
    request: {
      userId: asUuid(userId),
      email: "user@example.com",
      method: { decryptedKey: { decrypted_user_key: UNLOCKED_KEY_B64 } },
      kdfParams: { pBKDF2: { iterations: 600_000 } },
      accountCryptographicState: {} as never,
    },
    orgKeys: { ["org-1" as OrganizationId]: new EncString("2.abc|def|ghi") },
  });

  /** `super.unlock` resolves to the key the client is unlocked with; the override broadcasts it. */
  const unlockedKey = () => SymmetricCryptoKey.fromString(UNLOCKED_KEY_B64) as UserKey;

  const unlock = (svc: BrowserSdkService) => svc.unlock(userId, unlockData().request);

  afterEach(() => {
    // The spies below are installed on the shared prototype, so they must be restored or
    // calls leak into the next test.
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    messageSender = mock<MessageSender>();
    messages = new Subject();
    keyService = mock<KeyService>();
    accountService = mock<AccountService>();
    stateProvider = mock<StateProvider>();
    configService = mock<ConfigService>();

    accountService.accounts$ = of({});
    configService.userCachedFeatureFlag$.mockReturnValue(of(true) as never);

    const environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of(mock<Environment>());

    const messageListener = new MessageListener(messages.asObservable());

    createService = () =>
      new BrowserSdkService(
        mock<SdkClientFactory>(),
        environmentService,
        mock<PlatformUtilsService>(),
        accountService,
        () => mock<KdfConfigService>(),
        () => keyService,
        () => mock<AccountCryptographicStateService>(),
        () => mock<ApiService>(),
        stateProvider,
        () => configService,
        mock<V2UpgradeTokenStateService>(),
        messageSender,
        messageListener,
        mock<LogService>(),
      );

    service = createService();
  });

  describe("broadcasting local pushes", () => {
    it("re-sends an unlock so the other process can apply it", async () => {
      jest.spyOn(DefaultSdkService.prototype, "unlock").mockResolvedValue(unlockedKey());

      await unlock(service);

      expect(messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({ command: "sdkPush" }),
        expect.objectContaining({
          origin: expect.any(String),
          push: expect.objectContaining({ kind: "unlock", userId }),
        }),
      );
    });

    it("does not broadcast while the flag is off", async () => {
      configService.userCachedFeatureFlag$.mockReturnValue(of(false) as never);
      jest.spyOn(DefaultSdkService.prototype, "unlock").mockResolvedValue(unlockedKey());
      const flagOffService = createService();

      await unlock(flagOffService);

      // The local push was a no-op, so there is nothing to mirror — and no reason to put a serialized
      // user key on the runtime message bus.
      expect(messageSender.send).not.toHaveBeenCalled();
    });

    it("serializes flags as entries, because a Map does not survive JSON", async () => {
      jest.spyOn(DefaultSdkService.prototype, "setFlags").mockResolvedValue(undefined);

      await service.setFlags(userId, new Map([["flag-a", true]]));

      expect(messageSender.send).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          push: expect.objectContaining({ kind: "flags", flags: [["flag-a", true]] }),
        }),
      );
    });
  });

  describe("receiving remote pushes", () => {
    it("ignores its own broadcast, so the two processes do not loop", async () => {
      const parentUnlock = jest
        .spyOn(DefaultSdkService.prototype, "unlock")
        .mockResolvedValue(unlockedKey());

      service.init();
      parentUnlock.mockClear();

      // Capture this process's origin by broadcasting once, then replay it back.
      await unlock(service);
      const sent = messageSender.send.mock.calls.at(-1)![1] as { origin: string; push: unknown };
      parentUnlock.mockClear();

      messages.next({ command: "sdkPush", ...sent } as never);
      await new Promise(process.nextTick);

      expect(parentUnlock).not.toHaveBeenCalled();
    });

    it("applies a lock that originated in the other process", async () => {
      const parentLock = jest
        .spyOn(DefaultSdkService.prototype, "lock")
        .mockResolvedValue(undefined);

      service.init();

      messages.next({
        command: "sdkPush",
        origin: "some-other-process",
        push: { kind: "lock", userId },
      } as never);
      await new Promise(process.nextTick);

      expect(parentLock).toHaveBeenCalledWith(userId);
    });

    it("rebuilds EncString instances from the serialized org-key payload", async () => {
      const parentSetOrgKeys = jest
        .spyOn(DefaultSdkService.prototype, "setOrgKeys")
        .mockResolvedValue(undefined);

      service.init();

      // Round-trip through JSON exactly as chrome.runtime messaging would.
      await service.setOrgKeys(userId, unlockData().orgKeys);
      const sent = messageSender.send.mock.calls.at(-1)![1] as { origin: string; push: unknown };
      const wire = JSON.parse(
        JSON.stringify({ command: "sdkPush", origin: "other", push: (sent as any).push }),
      );
      parentSetOrgKeys.mockClear();

      messages.next(wire);
      await new Promise(process.nextTick);

      const [, orgKeys] = parentSetOrgKeys.mock.calls[0];
      expect(orgKeys["org-1" as OrganizationId]).toBeInstanceOf(EncString);
    });

    it("carries the user key inside the unlock request, which needs no rebuilding", async () => {
      const parentUnlock = jest
        .spyOn(DefaultSdkService.prototype, "unlock")
        .mockResolvedValue(unlockedKey());

      service.init();

      await unlock(service);
      const sent = messageSender.send.mock.calls.at(-1)![1] as { origin: string; push: unknown };
      const wire = JSON.parse(
        JSON.stringify({ command: "sdkPush", origin: "other", push: (sent as any).push }),
      );
      parentUnlock.mockClear();

      messages.next(wire);
      await new Promise(process.nextTick);

      const [, request] = parentUnlock.mock.calls[0];
      expect(request.method).toEqual({ decryptedKey: { decrypted_user_key: UNLOCKED_KEY_B64 } });
    });
  });

  describe("converging a freshly-started process", () => {
    it("unlocks from state when the vault is already unlocked, since the push was missed", async () => {
      const parentUnlock = jest
        .spyOn(DefaultSdkService.prototype, "unlock")
        .mockResolvedValue(unlockedKey());
      const parentSetOrgKeys = jest
        .spyOn(DefaultSdkService.prototype, "setOrgKeys")
        .mockResolvedValue(undefined);
      accountService.accounts$ = of({ [userId]: { email: "user@example.com" } } as never);
      keyService.userKey$.mockReturnValue(
        of(new SymmetricCryptoKey(new Uint8Array(64)) as UserKey),
      );
      keyService.buildSdkUnlockData.mockResolvedValue(unlockData());
      stateProvider.getUser.mockReturnValue({ state$: of(null) } as never);

      service.init();
      await new Promise(process.nextTick);

      expect(parentUnlock).toHaveBeenCalledWith(userId, expect.anything());
      // Org keys are what complete the unlock, so converging has to push them too or the client stays
      // gated and the vault never decrypts.
      expect(parentSetOrgKeys).toHaveBeenCalledWith(userId, expect.anything());
      // Converging is local; the other processes are already up to date.
      expect(messageSender.send).not.toHaveBeenCalled();
    });

    it("leaves a locked vault alone", async () => {
      const parentUnlock = jest
        .spyOn(DefaultSdkService.prototype, "unlock")
        .mockResolvedValue(unlockedKey());
      accountService.accounts$ = of({ [userId]: { email: "user@example.com" } } as never);
      keyService.userKey$.mockReturnValue(of(null));
      stateProvider.getUser.mockReturnValue({ state$: of(null) } as never);

      service.init();
      await new Promise(process.nextTick);

      expect(parentUnlock).not.toHaveBeenCalled();
    });

    it("does nothing while the rollout flag is off", async () => {
      const parentUnlock = jest
        .spyOn(DefaultSdkService.prototype, "unlock")
        .mockResolvedValue(unlockedKey());
      configService.userCachedFeatureFlag$.mockReturnValue(of(false) as never);
      accountService.accounts$ = of({ [userId]: { email: "user@example.com" } } as never);

      service.init();
      await new Promise(process.nextTick);

      expect(parentUnlock).not.toHaveBeenCalled();
    });
  });
});
