import { concatMap, filter, firstValueFrom, map, merge, Observable, of, Subscription } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkUnlockRequest } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
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
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { UnsignedSharedKey } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { BrowserApi } from "../../browser/browser-api";
import { getWebExtSender } from "../../utils/web-ext-sender";

/**
 * A push one process of the extension applied to its own SDK client, for the other process to
 * apply to its client. Everything in it survives the JSON serialization of `chrome.runtime`
 * messaging, which is why the flags travel as entries rather than a `Map`.
 */
export type SdkPush =
  | { kind: "unlock"; userId: UserId; userKeyB64: string }
  | { kind: "lock"; userId: UserId }
  | { kind: "logout"; userId: UserId }
  | { kind: "flags"; userId: UserId; entries: [string, boolean][] }
  | { kind: "orgKeys"; userId: UserId; orgKeys: Record<OrganizationId, UnsignedSharedKey> };

export type SdkPushMessage = {
  /** The process that applied the push first. Every process ignores its own pushes. */
  origin: string;
  push: SdkPush;
};

export const SDK_PUSH = new CommandDefinition<SdkPushMessage>("sdkPush");

/**
 * The SDK service of the browser extension, whose popup and background are separate processes,
 * each with its own SDK clients. Every push is applied locally and then broadcast, so the other
 * process applies it to its own client. A process that starts converges its clients from shared
 * state, which covers the broadcasts it was not running to receive.
 *
 * Interim: replaced wholesale once the cross-process design (PM-16908) is settled, so nothing
 * should build on it.
 */
export class BrowserSdkService extends DefaultSdkService {
  private readonly origin = Utils.newGuid();
  /**
   * The user key each user's client in this process was last unlocked with. Kept only between an
   * unlock and the next lock or logout, so a ready client can tell a push of the key it already
   * holds from a push of a new one (a key rotation).
   */
  private readonly appliedUserKeys = new Map<UserId, UserKey>();

  constructor(
    sdkClientFactory: SdkClientFactory,
    environmentService: EnvironmentService,
    platformUtilsService: PlatformUtilsService,
    accountService: AccountService,
    kdfConfigServiceProvider: () => KdfConfigService,
    private readonly keyServiceProvider: () => KeyService,
    apiServiceProvider: () => ApiService,
    stateProvider: StateProvider,
    configServiceProvider: () => ConfigService,
    v2UpgradeTokenStateService: V2UpgradeTokenStateService,
    managedSettingsService: ManagedSettingsService,
    appIdService: AppIdService,
    logService: LogService,
    tokenServiceProvider: () => TokenService,
    private readonly messageSender: MessageSender,
    private readonly messageListener: MessageListener,
  ) {
    super(
      sdkClientFactory,
      environmentService,
      platformUtilsService,
      accountService,
      kdfConfigServiceProvider,
      apiServiceProvider,
      stateProvider,
      configServiceProvider,
      v2UpgradeTokenStateService,
      managedSettingsService,
      appIdService,
      logService,
      tokenServiceProvider,
    );
  }

  /**
   * Starts applying the other process's pushes, after converging this process's clients from
   * shared state. Both run on one queue, so a push that arrives while converging is applied after
   * it rather than undone by it.
   */
  init(): Subscription {
    const remotePushes$: Observable<SdkPush | null> = this.messageListener.messages$(SDK_PUSH).pipe(
      filter((message) => message.origin !== this.origin && isFromExtensionPage(message)),
      map((message) => message.push),
    );

    return merge(of(null), remotePushes$)
      .pipe(concatMap((push) => (push == null ? this.converge() : this.applyRemote(push))))
      .subscribe();
  }

  override async unlock(userId: UserId, request: SdkUnlockRequest): Promise<UserKey> {
    this.appliedUserKeys.delete(userId);
    const userKey = await super.unlock(userId, request);
    this.appliedUserKeys.set(userId, userKey);
    await this.broadcast({ kind: "unlock", userId, userKeyB64: userKey.toBase64() });
    return userKey;
  }

  override async lock(userId: UserId): Promise<void> {
    this.appliedUserKeys.delete(userId);
    await super.lock(userId);
    await this.broadcast({ kind: "lock", userId });
  }

  override logout(userId: UserId): void {
    this.appliedUserKeys.delete(userId);
    // Synchronous, so the logout counter is bumped before this returns.
    super.logout(userId);
    void this.broadcast({ kind: "logout", userId });
  }

  override async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {
    await super.setFlags(userId, flags);
    await this.broadcast({ kind: "flags", userId, entries: [...flags.entries()] });
  }

  override async setOrgKeys(
    userId: UserId,
    orgKeys: Record<OrganizationId, UnsignedSharedKey>,
  ): Promise<void> {
    await this.setOrgKeysOrLockBoth(userId, orgKeys);
    await this.broadcast({ kind: "orgKeys", userId, orgKeys });
  }

  /** Applies the other process's push to this process's client, without broadcasting it again. */
  private async applyRemote(push: SdkPush): Promise<void> {
    try {
      switch (push.kind) {
        case "unlock":
          await this.unlockFromUserKey(
            push.userId,
            SymmetricCryptoKey.fromString(push.userKeyB64) as UserKey,
            this.lockEpoch(push.userId),
            true,
          );
          break;
        case "lock":
          this.appliedUserKeys.delete(push.userId);
          await super.lock(push.userId);
          break;
        case "logout":
          this.appliedUserKeys.delete(push.userId);
          super.logout(push.userId);
          break;
        case "flags":
          await super.setFlags(push.userId, new Map(push.entries));
          break;
        case "orgKeys":
          // A client that is not ready gets its organization keys from its own unlock. Applying
          // them here could fail it closed, which clears the user key in shared state.
          if (await firstValueFrom(this.cryptoReady$(push.userId))) {
            await super.setOrgKeys(push.userId, push.orgKeys);
          }
          break;
      }
    } catch (e) {
      this.logService.error(
        `[BrowserSdkService] Failed to apply a '${push.kind}' push from the other process`,
        e,
      );
    }
  }

  /**
   * Brings every client of this process in line with shared state: an unlocked user's client is
   * unlocked, and the user's flags are loaded.
   */
  private async converge(): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    for (const userId of Object.keys(accounts) as UserId[]) {
      try {
        await this.convergeUser(userId);
      } catch (e) {
        this.logService.error(`[BrowserSdkService] Failed to converge user (${userId})`, e);
      }
    }
  }

  private async convergeUser(userId: UserId): Promise<void> {
    // Captured before the user key is read, so a lock that lands while converging (such as a
    // vault timeout lock right after the background wakes) is not undone by this unlock.
    const epoch = this.lockEpoch(userId);
    const userKey = await firstValueFrom(this.keyServiceProvider().userKey$(userId));
    if (userKey != null) {
      await this.unlockFromUserKey(userId, userKey, epoch);
    }

    const config = await firstValueFrom(
      this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$,
    );
    if (config != null) {
      await super.setFlags(userId, toSdkFeatureFlags(config));
    }
  }

  /**
   * Unlocks this process's client with a user key and applies the organization keys built from
   * shared state, so the client becomes ready without depending on a later organization-key push.
   *
   * A client that is already ready is left alone: re-unlocking it clears the user key in shared
   * state for a moment, and the other process sees the user as locked. The exception is a pushed
   * key that differs from the one the client holds (`rekeyOnNewKey`): the other process unlocked
   * with a new user key after a key rotation, and this client must not keep the retired one.
   * Converging never re-keys, since it reads the key from the same shared state.
   */
  private async unlockFromUserKey(
    userId: UserId,
    userKey: UserKey,
    epoch: number,
    rekeyOnNewKey = false,
  ): Promise<void> {
    if (await firstValueFrom(this.cryptoReady$(userId))) {
      const applied = this.appliedUserKeys.get(userId);
      const newKey = applied != null && applied.keyB64 !== userKey.keyB64;
      if (!rekeyOnNewKey || !newKey) {
        return;
      }
    }

    const unlockData = await this.keyServiceProvider().buildSdkUnlockData(userId, userKey);
    if (unlockData == null) {
      throw new Error(`Missing the account cryptographic state of user (${userId})`);
    }

    // The base class rejects, and clears the client, if the user is locked after `epoch`. A lock
    // after the organization keys are applied finds a keyed client and clears it itself.
    this.appliedUserKeys.delete(userId);
    await this.unlockAtEpoch(userId, unlockData.request, epoch);
    this.appliedUserKeys.set(userId, userKey);
    await this.setOrgKeysOrLockBoth(userId, unlockData.orgKeys);
  }

  /**
   * Applies organization keys to this process's client. If that fails closed (the client was
   * finishing an unlock and got locked), the user key in shared state is cleared with it, so the
   * other process is told to lock too: its client may already be ready from its own unlock.
   */
  private async setOrgKeysOrLockBoth(
    userId: UserId,
    orgKeys: Record<OrganizationId, UnsignedSharedKey>,
  ): Promise<void> {
    const readyBefore = await firstValueFrom(this.cryptoReady$(userId));
    try {
      await super.setOrgKeys(userId, orgKeys);
    } catch (e) {
      if (!readyBefore) {
        this.appliedUserKeys.delete(userId);
        await this.broadcast({ kind: "lock", userId });
      }
      throw e;
    }
  }

  private async broadcast(push: SdkPush): Promise<void> {
    try {
      this.messageSender.send(SDK_PUSH, { origin: this.origin, push });
    } catch (e) {
      this.logService.error(`[BrowserSdkService] Failed to broadcast a '${push.kind}' push`, e);
    }
  }
}

/**
 * Whether a message was sent by a page of this extension, such as the popup, a popped-out popup
 * or the background. Content scripts can also reach `chrome.runtime.onMessage`, and must not be
 * able to push keys, locks or logouts into the SDK clients. The sender is the one the browser
 * stamped on the message, so the message body cannot fake it.
 */
function isFromExtensionPage(message: SdkPushMessage): boolean {
  const extensionUrl = BrowserApi.getRuntimeURL("");
  const senderUrl = getWebExtSender(message)?.url;
  return extensionUrl != null && senderUrl != null && senderUrl.startsWith(extensionUrl);
}
