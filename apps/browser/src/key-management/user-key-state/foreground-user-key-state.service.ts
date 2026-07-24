import { BehaviorSubject, Observable, filter, firstValueFrom, from, map, switchMap } from "rxjs";

import { UserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { UserId } from "@bitwarden/user-core";

import { fromChromeEvent } from "../../platform/browser/from-chrome-event";

import { USER_KEY_STATE_PORT_NAME, UserKeyStatePortMessage } from "./user-key-state-port";

/**
 * Popup-side proxy for {@link BackgroundUserKeyStateService}. The background owns
 * the authoritative copy; this service mirrors it locally, seeded by the
 * initialization snapshot on connect and kept current by update broadcasts.
 */
export class ForegroundUserKeyStateService implements UserKeyStateService {
  private port: chrome.runtime.Port;
  private backgroundResponses$: Observable<UserKeyStatePortMessage>;
  private mirror = new Map<UserId, BehaviorSubject<UserKey | null>>();
  private initialized: Promise<void>;

  constructor() {
    this.port = chrome.runtime.connect({ name: USER_KEY_STATE_PORT_NAME });
    this.backgroundResponses$ = fromChromeEvent(this.port.onMessage).pipe(
      map(([message]) => message as UserKeyStatePortMessage),
      filter((message) => message.originator === "background"),
    );

    this.initialized = firstValueFrom(
      this.backgroundResponses$.pipe(filter((message) => message.action === "initialization")),
    ).then((message) => {
      for (const [userId, keyB64] of message.data ?? []) {
        this.applyRemoteValue(userId, keyB64);
      }
    });

    this.backgroundResponses$
      .pipe(filter((message) => message.action === "update"))
      .subscribe((message) => {
        if (message.userId != null) {
          this.applyRemoteValue(message.userId, message.key ?? null);
        }
      });
  }

  async setUserKey(userId: UserId, key: UserKey | null): Promise<void> {
    await this.request({ action: "set", userId, key: key?.toBase64() ?? null });
    // Apply locally as well: the response confirms the background write, but the
    // update broadcast may not have arrived yet and callers expect the key to be
    // observable once this resolves.
    this.applyRemoteValue(userId, key?.toBase64() ?? null);
  }

  async getUserKey(userId: UserId): Promise<UserKey | null> {
    const response = await this.request({ action: "get", userId });
    return response.key == null ? null : (SymmetricCryptoKey.fromString(response.key) as UserKey);
  }

  userKey$(userId: UserId): Observable<UserKey | null> {
    return from(this.initialized).pipe(switchMap(() => this.subject(userId)));
  }

  private async request(
    data: Omit<UserKeyStatePortMessage, "originator" | "id">,
  ): Promise<UserKeyStatePortMessage> {
    const id = Utils.newGuid();
    // Listen for the response before sending the request
    const response = firstValueFrom(
      this.backgroundResponses$.pipe(filter((message) => message.id === id)),
    );
    this.port.postMessage({ ...data, id, originator: "foreground" });
    return await response;
  }

  private applyRemoteValue(userId: UserId, keyB64: string | null) {
    const subject = this.subject(userId);
    // Deduplicate: set responses and update broadcasts can carry the same value,
    // and re-emitting an identical key triggers spurious downstream re-decryption.
    if ((subject.value?.toBase64() ?? null) === keyB64) {
      return;
    }
    subject.next(keyB64 == null ? null : (SymmetricCryptoKey.fromString(keyB64) as UserKey));
  }

  private subject(userId: UserId): BehaviorSubject<UserKey | null> {
    let subject = this.mirror.get(userId);
    if (subject == null) {
      subject = new BehaviorSubject<UserKey | null>(null);
      this.mirror.set(userId, subject);
    }
    return subject;
  }
}
