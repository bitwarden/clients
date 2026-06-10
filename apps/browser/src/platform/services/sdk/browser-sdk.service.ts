import { concatMap, filter, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  toSdkFeatureFlags,
  USER_SERVER_CONFIG,
} from "@bitwarden/common/platform/services/config/default-config.service";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { InitUserCryptoRequest } from "@bitwarden/sdk-internal";

type SdkPush =
  // `InitUserCryptoRequest` is already JSON-safe. The request always carries a `decryptedKey` method here,
  // see the `unlock` override for why.
  | { kind: "unlock"; userId: UserId; request: InitUserCryptoRequest }
  | { kind: "lock"; userId: UserId }
  | { kind: "logout"; userId: UserId }
  // A Map serializes to `{}`, so flags travel as entries.
  | { kind: "flags"; userId: UserId; flags: [string, boolean][] }
  | { kind: "orgKeys"; userId: UserId; orgKeys: Record<string, string> };

const SDK_PUSH = new CommandDefinition<{ origin: string; push: SdkPush }>("sdkPush");

/** `EncString` instances do not survive `chrome.runtime` serialization, so they travel as strings. */
function fromOrgKeys(orgKeys: Record<OrganizationId, EncString>): Record<string, string> {
  return Object.fromEntries(Object.entries(orgKeys).map(([orgId, key]) => [orgId, key.toJSON()]));
}

function toOrgKeys(orgKeys: Record<string, string>): Record<OrganizationId, EncString> {
  return Object.fromEntries(
    Object.entries(orgKeys).map(([orgId, key]) => [orgId, EncString.fromJSON(key)]),
  ) as Record<OrganizationId, EncString>;
}

/**
 * The browser extension runs the popup and the background in separate processes, each with its own
 * `SdkService` and its own WASM clients. The owner pushes that drive the long-lived client are
 * in-process method calls, so a change made in one process never reaches the other: an unlock
 * performed on the popup's lock screen would leave the background's client locked, and a lock
 * triggered by the background's vault-timeout would leave the popup's client holding a live user key.
 *
 * This subclass closes that gap in two parts:
 *
 * 1. **Broadcast.** Each push is applied locally, then re-sent to the other processes, tagged with
 *    this process's `origin` so we ignore the echo of our own message.
 * 2. **Converge on start.** A process that has just started (a popup being opened, or an MV3 service
 *    worker waking after eviction) missed every prior broadcast, so `init` seeds from state. IPC
 *    alone cannot cover this: a process that does not exist cannot receive a message.
 *
 * The user key already crosses this boundary today — `USER_KEY` is `CRYPTO_MEMORY`, which is
 * `chrome.storage.session` under MV3 and a `ForegroundMemoryStorageService` port under MV2 — so this
 * adds a channel rather than a new class of exposure. It is still a wider audience than a targeted
 * port, since `chrome.runtime` messages reach every listening extension context.
 *
 * Interim by design. PM-16908 (synchronized SDK-owned state) owns the cross-process question and weighs a
 * single instance reached over IPC against synchronizing state and a hybrid of the two. This is the least
 * that makes the browser correct on the long-lived path — closest to the synced-state option, applied at the
 * push level — and inherits that option's costs: memory state is not synchronized, so the SDK's internal
 * state machine is not either, and a process can be briefly stale between a push and its broadcast. That
 * holds only while these five pushes are the whole of the clients' SDK state. Whatever PM-16908 decides
 * replaces this class, so do not build on it.
 */
export class BrowserSdkService extends DefaultSdkService {
  /** Identifies this process so its own broadcasts are filtered out on receipt. */
  private readonly origin = Utils.newGuid();

  constructor(
    sdkClientFactory: SdkClientFactory,
    environmentService: EnvironmentService,
    platformUtilsService: PlatformUtilsService,
    accountService: AccountService,
    kdfConfigServiceProvider: () => KdfConfigService,
    keyServiceProvider: () => KeyService,
    accountCryptographyStateServiceProvider: () => AccountCryptographicStateService,
    apiServiceProvider: () => ApiService,
    stateProvider: StateProvider,
    configServiceProvider: () => ConfigService,
    v2UpgradeTokenStateService: V2UpgradeTokenStateService,
    private messageSender: MessageSender,
    private messageListener: MessageListener,
    private logService: LogService,
    userAgent: string | null = null,
  ) {
    super(
      sdkClientFactory,
      environmentService,
      platformUtilsService,
      accountService,
      kdfConfigServiceProvider,
      keyServiceProvider,
      accountCryptographyStateServiceProvider,
      apiServiceProvider,
      stateProvider,
      configServiceProvider,
      v2UpgradeTokenStateService,
      userAgent,
    );
  }

  /**
   * Start listening for pushes from other processes and converge this one on the current state.
   * Called from `main.background.ts` and from the popup's `APP_INITIALIZER`; a process that never
   * calls this keeps a client that only ever sees its own pushes.
   */
  init(): void {
    this.messageListener
      .messages$(SDK_PUSH)
      .pipe(
        filter((message) => message.origin !== this.origin),
        // Serialize: an unlock and a lock arriving together must not interleave.
        concatMap((message) => this.applyRemote(message.push)),
      )
      .subscribe();

    void this.converge();
  }

  override async unlock(userId: UserId, request: InitUserCryptoRequest): Promise<UserKey | null> {
    const userKey = await super.unlock(userId, request);
    if (userKey != null) {
      // Always broadcast a `decryptedKey` unlock, whatever method this process used. A credential method
      // would make the peer re-derive from a credential it does not have; the key `super.unlock` just
      // returned is what the peer needs. For a caller that already passed `decryptedKey`, this is the same
      // key it passed in.
      //
      // The peer stays not-ready until the matching `orgKeys` push arrives, which is correct: it genuinely
      // cannot decrypt organization data yet.
      await this.broadcast({
        kind: "unlock",
        userId,
        request: { ...request, method: { decryptedKey: { decrypted_user_key: userKey.toSdk() } } },
      });
    }
    return userKey;
  }

  override async lock(userId: UserId): Promise<void> {
    await super.lock(userId);
    await this.broadcast({ kind: "lock", userId });
  }

  override logout(userId: UserId): void {
    super.logout(userId);
    // Fire-and-forget, like `super.logout`: `LogoutService.logout` does not await either.
    void this.broadcast({ kind: "logout", userId });
  }

  override async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {
    await super.setFlags(userId, flags);
    await this.broadcast({ kind: "flags", userId, flags: [...flags.entries()] });
  }

  override async setOrgKeys(
    userId: UserId,
    orgKeys: Record<OrganizationId, EncString>,
  ): Promise<void> {
    await super.setOrgKeys(userId, orgKeys);
    await this.broadcast({ kind: "orgKeys", userId, orgKeys: fromOrgKeys(orgKeys) });
  }

  /**
   * Apply a push that originated in another process. Calls `super` so it is not re-broadcast, which
   * would otherwise loop between processes.
   */
  private async applyRemote(push: SdkPush): Promise<void> {
    try {
      switch (push.kind) {
        case "unlock":
          await super.unlock(push.userId, push.request);
          break;
        case "lock":
          await super.lock(push.userId);
          break;
        case "logout":
          super.logout(push.userId);
          break;
        case "flags":
          await super.setFlags(push.userId, new Map(push.flags));
          break;
        case "orgKeys":
          await super.setOrgKeys(push.userId, toOrgKeys(push.orgKeys));
          break;
      }
    } catch (e) {
      // A failed apply must not tear down the listener, or this process stops converging entirely.
      this.logService.error(`Failed to apply remote SDK push (${push.kind})`, e);
    }
  }

  /**
   * Bring a freshly-started process up to date. Reads the current state rather than waiting for the
   * next change, because every broadcast before this point was missed.
   */
  private async converge(): Promise<void> {
    try {
      const accounts = await firstValueFrom(this.accountService.accounts$);
      // The flag is resolved per user, so it is checked per user rather than once for the whole loop.
      for (const userId of Object.keys(accounts ?? {}) as UserId[]) {
        if (!(await this.longLivedEnabled(userId))) {
          continue;
        }
        await this.convergeUser(userId);
      }
    } catch (e) {
      this.logService.error("Failed to converge SDK clients on startup", e);
    }
  }

  private async convergeUser(userId: UserId): Promise<void> {
    const keyService = this.keyServiceProvider();

    // An unlocked vault: rebuild the payload from the key already in (shared) state. `unlock` covers org
    // keys too, so this seeds both and leaves the client ready. A locked vault needs nothing — the
    // token-only client built by the `accounts$` subscription is already correct.
    const userKey = await firstValueFrom(keyService.userKey$(userId));
    if (userKey != null) {
      const data = await keyService.buildSdkUnlockData(userId, userKey);
      if (data != null) {
        // `super`, not `this`: converging is local, the other processes are already up to date.
        // `setOrgKeys` is what completes the unlock and marks the client ready, so it is not optional.
        await super.unlock(userId, data.request);
        await super.setOrgKeys(userId, data.orgKeys);
      }
    }

    const config = await firstValueFrom(
      this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$,
    );
    if (config != null) {
      await super.setFlags(userId, toSdkFeatureFlags(config));
    }
  }

  /**
   * Mirror a push to the other extension processes. Gated on the flag: while it is off the local pushes
   * were no-ops, so there is nothing to mirror, and broadcasting would put a serialized user key on the
   * runtime message bus — which every listening extension context can see — for no reason. The flag is
   * memoized per user on the base class and resolves from cached state, so this await is cheap and, more
   * importantly, cannot stall: `ConfigService.renewConfig` awaits `setFlags`, which reaches this method.
   */
  private async broadcast(push: SdkPush): Promise<void> {
    if (!(await this.longLivedEnabled(push.userId))) {
      return;
    }
    this.messageSender.send(SDK_PUSH, { origin: this.origin, push });
  }
}
