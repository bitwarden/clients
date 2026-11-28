import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { USER_KEY } from "@bitwarden/common/key-management/state-definitions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { FakeAccountService, FakeStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  EncryptService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { DesktopRendererKeyService } from "./desktop-renderer-key.service";
import { UnlockSessionsResponse } from "./unlock/unlock-ipc.types";

const userId = "user-1" as UserId;
const otherUserId = "user-2" as UserId;
const userKeyB64 = new SymmetricCryptoKey(new Uint8Array(64)).toBase64();

/** Flush pending microtasks so the service's async seeding settles. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("DesktopRendererKeyService", () => {
  let stateProvider: FakeStateProvider;
  let getUnlockSessions: jest.Mock;
  /** Delivers what main would push on the unlock-sessions channel. */
  let push: (sessions: UnlockSessionsResponse) => void;

  beforeEach(() => {
    const accountService = new FakeAccountService({});
    stateProvider = new FakeStateProvider(accountService);
    getUnlockSessions = jest.fn().mockResolvedValue({ unlocked: {} });

    (global as any).ipc = {
      keyManagement: {
        unlock: {
          getUnlockSessions,
          onUnlockSessionsChanged: jest.fn().mockImplementation((callback) => {
            push = callback;
            return () => undefined;
          }),
        },
      },
    };
  });

  function createService(): DesktopRendererKeyService {
    return new DesktopRendererKeyService(
      mock<CryptoFunctionService>(),
      mock<EncryptService>(),
      mock<PlatformUtilsService>(),
      mock<LogService>(),
      mock<StateService>(),
      stateProvider,
      mock<AccountCryptographicStateService>(),
      mock<BiometricsService>(),
      mock<SdkService>(),
    );
  }

  it("seeds the keys main already holds on construction", async () => {
    getUnlockSessions.mockResolvedValue({ unlocked: { [userId]: { userKeyB64 } } });

    const service = createService();
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).not.toBeNull();
    // The SDK reads the key from state through its default bridge, so it has to land there too.
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).not.toBeNull();
  });

  it("adopts a key main pushes after startup", async () => {
    const service = createService();
    await flush();

    push({ unlocked: { [userId]: { userKeyB64 } } });
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).not.toBeNull();
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).not.toBeNull();
  });

  it("drops a key main no longer holds, because each push carries the whole set", async () => {
    getUnlockSessions.mockResolvedValue({ unlocked: { [userId]: { userKeyB64 } } });
    const service = createService();
    await flush();

    push({ unlocked: {} });
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
  });

  it("clears the key from state when main drops it, not just from the cache", async () => {
    getUnlockSessions.mockResolvedValue({ unlocked: { [userId]: { userKeyB64 } } });
    const service = createService();
    await flush();

    // Main locked the account and pushed the now-empty set.
    push({ unlocked: {} });
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
    // The SDK reads the key from state through its bridge, so leaving it there keeps a
    // locked account's key readable.
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).toBeNull();
  });

  it("does not let an earlier push overwrite a later one", async () => {
    const service = createService();
    await flush();

    // Two pushes in the same tick: main unlocked, then immediately locked. Applying a push
    // awaits one state write per key, so the empty one can finish first and be undone.
    push({ unlocked: { [userId]: { userKeyB64 } } });
    push({ unlocked: {} });
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
  });

  it("keeps the accounts a push still lists while dropping the ones it does not", async () => {
    getUnlockSessions.mockResolvedValue({
      unlocked: { [userId]: { userKeyB64 }, [otherUserId]: { userKeyB64 } },
    });
    const service = createService();
    await flush();

    push({ unlocked: { [otherUserId]: { userKeyB64 } } });
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
    expect(await firstValueFrom(service.userKey$(otherUserId))).not.toBeNull();
  });

  it("hasUserKey is false before any key arrives and true once one does", async () => {
    const service = createService();
    await flush();

    expect(await service.hasUserKey(userId)).toBe(false);

    push({ unlocked: { [userId]: { userKeyB64 } } });
    await flush();

    expect(await service.hasUserKey(userId)).toBe(true);
  });

  it("does not treat a user key as present for a null user id", async () => {
    const service = createService();
    await flush();

    expect(await service.hasUserKey(null as unknown as UserId)).toBe(false);
  });

  it("holds no key for an account main never reported", async () => {
    const service = createService();
    await flush();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).toBeNull();
  });
});
