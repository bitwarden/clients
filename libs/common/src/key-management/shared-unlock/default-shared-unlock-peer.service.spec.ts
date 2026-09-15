import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { SharedUnlockClient, SharedUnlockPeer } from "@bitwarden/sdk-internal";
import { LockService, LockSource, UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { mockAccountInfoWith } from "../../../spec";
import { AccountService } from "../../auth/abstractions/account.service";
import { ClientType } from "../../enums";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { IpcService } from "../../platform/ipc";
import { UserId } from "../../types/guid";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { DefaultSharedUnlockPeerService } from "./default-shared-unlock-peer.service";
import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

describe("DefaultSharedUnlockPeerService", () => {
  const userId = "8796a0d1-a4b0-4a1e-9c3b-1b0b1b0b1b0b" as UserId;

  let ipcService: MockProxy<IpcService>;
  let accountService: MockProxy<AccountService>;
  let lockService: MockProxy<LockService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let environmentService: MockProxy<EnvironmentService>;
  let settingsService: MockProxy<SharedUnlockSettingsService>;
  let unlockService: MockProxy<UnlockService>;
  let configService: MockProxy<ConfigService>;
  let peer: MockProxy<SharedUnlockPeer>;

  let featureEnabled: BehaviorSubject<boolean>;
  let sharingDisabled: BehaviorSubject<boolean>;
  let allowDesktop: BehaviorSubject<boolean>;
  let allowWeb: BehaviorSubject<boolean>;

  /** Lets the account subscription's async work settle, since `start` does not await it. */
  async function flush(): Promise<void> {
    await new Promise((resolve) => process.nextTick(resolve));
  }

  /** Builds a peer service wired to the mocks above. */
  function build(): DefaultSharedUnlockPeerService {
    return new DefaultSharedUnlockPeerService(
      ipcService,
      accountService,
      lockService,
      platformUtilsService,
      vaultTimeoutSettingsService,
      environmentService,
      settingsService,
      unlockService,
      configService,
      () => peer,
    );
  }

  /** Starts a peer for one client type and reports the destinations it was given. */
  async function startFor(clientType: ClientType): Promise<SharedUnlockClient[][]> {
    platformUtilsService.getClientType.mockReturnValue(clientType);

    await build().start();
    await flush();

    return peer.set_destinations.mock.calls.map(([, destinations]) => destinations);
  }

  beforeEach(() => {
    jest.clearAllMocks();

    ipcService = mock<IpcService>();
    accountService = mock<AccountService>();
    lockService = mock<LockService>();
    platformUtilsService = mock<PlatformUtilsService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    environmentService = mock<EnvironmentService>();
    settingsService = mock<SharedUnlockSettingsService>();
    unlockService = mock<UnlockService>();
    configService = mock<ConfigService>();
    peer = mock<SharedUnlockPeer>();

    featureEnabled = new BehaviorSubject(true);
    sharingDisabled = new BehaviorSubject(false);
    allowDesktop = new BehaviorSubject(true);
    allowWeb = new BehaviorSubject(true);

    accountService.accounts$ = of({
      [userId]: mockAccountInfoWith({ email: "user@example.com", name: "User" }),
    });
    configService.getFeatureFlag$.mockImplementation((flag) =>
      flag === FeatureFlag.SharedUnlockPart2 ? featureEnabled : of(false),
    );
    settingsService.unlockSharingDisabled$.mockReturnValue(sharingDisabled);
    settingsService.allowSharingUnlockStateWithDesktop$.mockReturnValue(allowDesktop);
    settingsService.allowSharingUnlockStateWithWeb$.mockReturnValue(allowWeb);
  });

  describe("destinations", () => {
    it("shares the CLI's unlock state with the desktop app", async () => {
      expect(await startFor(ClientType.Cli)).toEqual([["Desktop"]]);
    });

    it("shares nothing from the CLI when desktop sharing is off", async () => {
      allowDesktop.next(false);

      expect(await startFor(ClientType.Cli)).toEqual([[]]);
    });

    it.each([ClientType.Desktop, ClientType.Web])(
      "shares %s unlock state with the browser, which is also how the CLI is reached",
      async (clientType) => {
        expect(await startFor(clientType)).toEqual([["Browser"]]);
      },
    );

    it.each([
      [true, true, ["Desktop", "Web"]],
      [true, false, ["Desktop"]],
      [false, true, ["Web"]],
      [false, false, []],
    ])(
      "shares browser unlock state per its settings (desktop %s, web %s)",
      async (desktop, web, expected) => {
        allowDesktop.next(desktop);
        allowWeb.next(web);

        expect(await startFor(ClientType.Browser)).toEqual([expected]);
      },
    );

    it.each([ClientType.Browser, ClientType.Cli, ClientType.Desktop])(
      "shares nothing from %s when the feature flag is off",
      async (clientType) => {
        featureEnabled.next(false);

        expect(await startFor(clientType)).toEqual([[]]);
      },
    );

    it.each([ClientType.Browser, ClientType.Cli, ClientType.Desktop])(
      "shares nothing from %s when the device is not trusted",
      async (clientType) => {
        sharingDisabled.next(true);

        expect(await startFor(clientType)).toEqual([[]]);
      },
    );
  });

  describe("start", () => {
    it("passes the abort controller through to the peer", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Cli);
      const abortController = new AbortController();

      await build().start(abortController);

      expect(peer.start).toHaveBeenCalledWith(abortController);
    });

    it("stops watching destinations once aborted", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Cli);
      const abortController = new AbortController();

      await build().start(abortController);
      await flush();
      expect(peer.set_destinations).toHaveBeenCalled();
      peer.set_destinations.mockClear();

      abortController.abort();
      allowDesktop.next(false);

      expect(peer.set_destinations).not.toHaveBeenCalled();
    });
  });

  describe("device events", () => {
    it("announces an unlock this device performed", async () => {
      await startFor(ClientType.Cli);
      const onUnlock = unlockService.registerOnUnlockAction.mock.calls[0][0];
      const userKey = { toSdk: () => "user-key" } as never;

      await onUnlock(userId, userKey, UnlockMethod.MasterPassword);

      expect(peer.handle_device_event).toHaveBeenCalledWith({
        ManualUnlock: { user_id: asUuid(userId), user_key: "user-key" },
      });
    });

    it("does not announce an unlock a peer handed it, which would loop", async () => {
      await startFor(ClientType.Cli);
      const onUnlock = unlockService.registerOnUnlockAction.mock.calls[0][0];

      await onUnlock(userId, { toSdk: () => "user-key" } as never, UnlockMethod.SharedUnlock);

      expect(peer.handle_device_event).not.toHaveBeenCalled();
    });

    it("announces a lock this device performed", async () => {
      await startFor(ClientType.Cli);
      const onLock = lockService.registerOnLockAction.mock.calls[0][0];

      await onLock(userId, LockSource.Manual);

      expect(peer.handle_device_event).toHaveBeenCalledWith({
        ManualLock: { user_id: asUuid(userId) },
      });
    });

    it("does not announce a lock a peer caused, which would loop", async () => {
      await startFor(ClientType.Cli);
      const onLock = lockService.registerOnLockAction.mock.calls[0][0];

      await onLock(userId, LockSource.SharedUnlock);

      expect(peer.handle_device_event).not.toHaveBeenCalled();
    });
  });
});
