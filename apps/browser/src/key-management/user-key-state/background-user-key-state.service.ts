import { Observable, from, switchMap } from "rxjs";

import { DefaultUserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { LogService } from "@bitwarden/logging";
import { StorageService } from "@bitwarden/storage-core";
import { UserId } from "@bitwarden/user-core";

import { BrowserApi } from "../../platform/browser/browser-api";

import { USER_KEY_STATE_PORT_NAME, UserKeyStatePortMessage } from "./user-key-state-port";

const SESSION_STORAGE_KEY = "userKeyState";

/**
 * Holds the authoritative copy of the user keys for the extension. Serves connected
 * popup instances over a port (snapshot on connect, updates on change) and, on MV3,
 * writes through to session storage so keys survive service worker termination.
 */
export class BackgroundUserKeyStateService extends DefaultUserKeyStateService {
  private ports: chrome.runtime.Port[] = [];
  private readonly initialized: Promise<void>;

  /**
   * @param sessionStorage Storage surviving service worker restarts (MV3), or null
   * when the background is persistent (MV2) and no write-through is needed.
   */
  constructor(
    private readonly logService: LogService,
    private readonly sessionStorage: StorageService | null,
  ) {
    super();
    this.initialized = this.hydrate();

    BrowserApi.addListener(chrome.runtime.onConnect, (port) => {
      if (port.name !== USER_KEY_STATE_PORT_NAME) {
        return;
      }
      if (!BrowserApi.senderIsInternal(port.sender, this.logService)) {
        return;
      }

      this.ports.push(port);
      const listenerCallback = (message: UserKeyStatePortMessage) =>
        void this.onMessageFromForeground(message, port);
      port.onDisconnect.addListener(() => {
        this.ports.splice(this.ports.indexOf(port), 1);
        port.onMessage.removeListener(listenerCallback);
      });
      port.onMessage.addListener(listenerCallback);

      void this.initialized.then(() => {
        this.sendMessageTo(port, { action: "initialization", data: this.snapshot() });
      });
    });
  }

  override async setUserKey(userId: UserId, key: UserKey | null): Promise<void> {
    await this.initialized;
    await super.setUserKey(userId, key);
    await this.persist();
    this.broadcastMessage({ action: "update", userId, key: key?.toBase64() ?? null });
  }

  override async getUserKey(userId: UserId): Promise<UserKey | null> {
    await this.initialized;
    return await super.getUserKey(userId);
  }

  override userKey$(userId: UserId): Observable<UserKey | null> {
    return from(this.initialized).pipe(switchMap(() => super.userKey$(userId)));
  }

  private async hydrate(): Promise<void> {
    if (this.sessionStorage == null) {
      return;
    }
    const stored = await this.sessionStorage.get<Record<UserId, string>>(SESSION_STORAGE_KEY);
    for (const [userId, keyB64] of Object.entries(stored ?? {})) {
      await super.setUserKey(userId as UserId, SymmetricCryptoKey.fromString(keyB64) as UserKey);
    }
  }

  private async persist(): Promise<void> {
    if (this.sessionStorage == null) {
      return;
    }
    const record: Record<UserId, string> = {};
    for (const [userId, keyB64] of this.snapshot()) {
      if (keyB64 != null) {
        record[userId] = keyB64;
      }
    }
    await this.sessionStorage.save(SESSION_STORAGE_KEY, record);
  }

  private async onMessageFromForeground(
    message: UserKeyStatePortMessage,
    port: chrome.runtime.Port,
  ): Promise<void> {
    if (message.originator !== "foreground" || message.userId == null) {
      return;
    }

    switch (message.action) {
      case "get": {
        const key = await this.getUserKey(message.userId);
        this.sendMessageTo(port, {
          id: message.id,
          action: "get",
          userId: message.userId,
          key: key?.toBase64() ?? null,
        });
        break;
      }
      case "set": {
        const key =
          message.key == null ? null : (SymmetricCryptoKey.fromString(message.key) as UserKey);
        await this.setUserKey(message.userId, key);
        // Respond only after the write completes, so the foreground's setUserKey
        // resolves once the key is observable.
        this.sendMessageTo(port, { id: message.id, action: "set", userId: message.userId });
        break;
      }
    }
  }

  private snapshot(): [UserId, string | null][] {
    return this.entries().map(([userId, key]) => [userId, key?.toBase64() ?? null]);
  }

  private broadcastMessage(data: Omit<UserKeyStatePortMessage, "originator">) {
    this.ports.forEach((port) => this.sendMessageTo(port, data));
  }

  private sendMessageTo(
    port: chrome.runtime.Port,
    data: Omit<UserKeyStatePortMessage, "originator">,
  ) {
    port.postMessage({ ...data, originator: "background" } satisfies UserKeyStatePortMessage);
  }
}
