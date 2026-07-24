import { Observable, ReplaySubject, defer, from, switchMap } from "rxjs";

import { UserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { UserId } from "@bitwarden/user-core";

/**
 * Renderer-side proxy for {@link MainUserKeyStateService}. The main process owns
 * the authoritative copy (so keys survive renderer reloads); this service mirrors
 * it locally, seeded lazily per user on first subscription and kept current by
 * update pushes from main.
 */
export class RendererUserKeyStateService implements UserKeyStateService {
  private mirror = new Map<UserId, ReplaySubject<UserKey | null>>();
  /** Last mirrored value per user, as base64; presence marks the mirror as populated. */
  private lastValue = new Map<UserId, string | null>();
  private seedPromises = new Map<UserId, Promise<void>>();

  constructor() {
    ipc.keyManagement.userKeyState.onUpdate((update) => {
      this.applyRemoteValue(update.userId as UserId, update.key);
    });
  }

  async setUserKey(userId: UserId, key: UserKey | null): Promise<void> {
    await ipc.keyManagement.userKeyState.set(userId, key?.toBase64() ?? null);
    // Apply locally as well: the invoke confirms the main-process write, but the
    // update push may not have arrived yet and callers expect the key to be
    // observable once this resolves.
    this.applyRemoteValue(userId, key?.toBase64() ?? null);
  }

  async getUserKey(userId: UserId): Promise<UserKey | null> {
    const keyB64 = await ipc.keyManagement.userKeyState.get(userId);
    return keyB64 == null ? null : (SymmetricCryptoKey.fromString(keyB64) as UserKey);
  }

  userKey$(userId: UserId): Observable<UserKey | null> {
    // Emits nothing until the value is read from main, rather than a placeholder
    // null that would briefly report an unlocked user as locked.
    return defer(() => from(this.seed(userId)).pipe(switchMap(() => this.subject(userId))));
  }

  private seed(userId: UserId): Promise<void> {
    let promise = this.seedPromises.get(userId);
    if (promise == null) {
      promise = this.getUserKey(userId).then((key) => {
        // An update push may have arrived while the read was in flight; it wins.
        if (!this.lastValue.has(userId)) {
          this.applyRemoteValue(userId, key?.toBase64() ?? null);
        }
      });
      this.seedPromises.set(userId, promise);
    }
    return promise;
  }

  private applyRemoteValue(userId: UserId, keyB64: string | null) {
    // Deduplicate: set confirmations and update pushes can carry the same value,
    // and re-emitting an identical key triggers spurious downstream re-decryption.
    if (this.lastValue.has(userId) && this.lastValue.get(userId) === keyB64) {
      return;
    }
    this.lastValue.set(userId, keyB64);
    this.subject(userId).next(
      keyB64 == null ? null : (SymmetricCryptoKey.fromString(keyB64) as UserKey),
    );
  }

  private subject(userId: UserId): ReplaySubject<UserKey | null> {
    let subject = this.mirror.get(userId);
    if (subject == null) {
      subject = new ReplaySubject<UserKey | null>(1);
      this.mirror.set(userId, subject);
    }
    return subject;
  }
}
