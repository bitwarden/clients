import { mock } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { USER_KEY } from "@bitwarden/common/key-management/state-definitions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Message, MessageListener } from "@bitwarden/common/platform/messaging";
import { FakeAccountService, FakeStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  EncryptService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { DesktopRendererKeyService } from "./desktop-renderer-key.service";

const userId = "user-1" as UserId;
const userKeyB64 = new SymmetricCryptoKey(new Uint8Array(64)).toBase64();

describe("DesktopRendererKeyService", () => {
  let stateProvider: FakeStateProvider;
  let messages$: Subject<Message<Record<string, unknown>>>;
  let messageListener: MessageListener;

  beforeEach(() => {
    const accountService = new FakeAccountService({});
    stateProvider = new FakeStateProvider(accountService);
    messages$ = new Subject();
    messageListener = new MessageListener(messages$);

    (global as any).ipc = {
      keyManagement: {
        unlock: {
          getUnlockSessions: jest.fn().mockResolvedValue({ unlocked: {} }),
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
      messageListener,
    );
  }

  it("seeds the key from main's unlock sessions on construction", async () => {
    (global as any).ipc.keyManagement.unlock.getUnlockSessions.mockResolvedValue({
      unlocked: { [userId]: { userKeyB64 } },
    });

    const service = createService();
    await flushMicrotasks();

    expect(await firstValueFrom(service.userKey$(userId))).not.toBeNull();
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).not.toBeNull();
  });

  it("sets the key, and the SDK's state-bridge-backed value, on an unlockCompleted message", async () => {
    const service = createService();
    await flushMicrotasks();

    messages$.next({ command: "unlockCompleted", userId, userKeyB64 } as unknown as Message<
      Record<string, unknown>
    >);
    await flushMicrotasks();

    const key = await firstValueFrom(service.userKey$(userId));
    expect(key?.keyB64).toBe(userKeyB64);

    const sdkKey = await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId));
    expect((sdkKey as UserKey)?.keyB64).toBe(userKeyB64);
  });

  it("clears the key, and the SDK's state-bridge-backed value, on a locked message", async () => {
    const service = createService();
    messages$.next({ command: "unlockCompleted", userId, userKeyB64 } as unknown as Message<
      Record<string, unknown>
    >);
    await flushMicrotasks();

    messages$.next({ command: "locked", userId } as unknown as Message<Record<string, unknown>>);
    await flushMicrotasks();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).toBeNull();
  });

  it("clears the key, and the SDK's state-bridge-backed value, on a logout message", async () => {
    const service = createService();
    messages$.next({ command: "unlockCompleted", userId, userKeyB64 } as unknown as Message<
      Record<string, unknown>
    >);
    await flushMicrotasks();

    messages$.next({ command: "logout", userId } as unknown as Message<Record<string, unknown>>);
    await flushMicrotasks();

    expect(await firstValueFrom(service.userKey$(userId))).toBeNull();
    expect(await firstValueFrom(stateProvider.getUserState$(USER_KEY, userId))).toBeNull();
  });

  it("hasUserKey is false before any key arrives and true once one does", async () => {
    const service = createService();
    await flushMicrotasks();

    expect(await service.hasUserKey(userId)).toBe(false);

    messages$.next({ command: "unlockCompleted", userId, userKeyB64 } as unknown as Message<
      Record<string, unknown>
    >);
    await flushMicrotasks();

    expect(await service.hasUserKey(userId)).toBe(true);
  });
});

/** Flushes pending microtasks so async message handlers settle. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));
