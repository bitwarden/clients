import { firstValueFrom, map, merge, Observable } from "rxjs";

import {
  CipherUse,
  SaveCandidate,
} from "@bitwarden/browser/autofill/services/abstractions/fill-cipher-policy";
import { DefaultFillCipherPolicy } from "@bitwarden/browser/autofill/services/default-fill-cipher-policy";
import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { SortedCiphersCache } from "@bitwarden/common/vault/models/domain/sorted-ciphers-cache";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Adds the revealed views (see {@link RevealedCipherService}) to user fills only. Every other use
 * gets the stored ciphers. Blocks a save prompt for a form that holds a revealed login.
 */
export class PamFillCipherPolicy extends DefaultFillCipherPolicy {
  /** The keyboard shortcut rotation, used only while the user has revealed views. */
  private readonly sortedCiphersCache: SortedCiphersCache;
  /** The ciphers each cached URL was built from, so a change rebuilds the rotation. */
  private readonly cachedSignatures = new Map<string, string>();

  constructor(
    cipherService: CipherService,
    private readonly revealedCipherService: RevealedCipherService,
  ) {
    super(cipherService);
    this.sortedCiphersCache = new SortedCiphersCache((a, b) =>
      this.cipherService.sortCiphersByLastUsed(a, b),
    );
  }

  override changed$(userId: UserId): Observable<void> {
    return merge(
      super.changed$(userId),
      this.revealedCipherService.revealed$(userId).pipe(map((): void => undefined)),
    );
  }

  override async ciphers(userId: UserId, use: CipherUse): Promise<CipherView[]> {
    if (use !== CipherUse.UserFill) {
      return super.ciphers(userId, use);
    }
    const [ciphers, revealed] = await Promise.all([
      super.ciphers(userId, use),
      this.getRevealed(userId),
    ]);
    return withRevealed(ciphers, revealed);
  }

  override async ciphersForUrl(
    url: string,
    userId: UserId,
    use: CipherUse,
    options?: { includeOtherTypes?: CipherType[]; defaultMatch?: UriMatchStrategySetting },
  ): Promise<CipherView[]> {
    if (use !== CipherUse.UserFill) {
      return super.ciphersForUrl(url, userId, use, options);
    }
    const [ciphers, revealed] = await Promise.all([
      super.ciphersForUrl(url, userId, use, options),
      this.getRevealed(userId),
    ]);
    if (revealed.length === 0) {
      return ciphers;
    }
    const matching = await this.cipherService.filterCiphersForUrl(
      revealed,
      url,
      options?.includeOtherTypes,
      options?.defaultMatch,
    );
    return withRevealed(ciphers, matching);
  }

  override async nextCipherForUrl(url: string, userId: UserId): Promise<CipherView | undefined> {
    if ((await this.getRevealed(userId)).length === 0) {
      return super.nextCipherForUrl(url, userId);
    }

    const ciphers = await this.ciphersForUrl(url, userId, CipherUse.UserFill);
    if (ciphers.length === 0) {
      return undefined;
    }
    // A revealed view that ends, or a stored cipher that changes, rebuilds the rotation.
    const signature = ciphers
      .map((c) => `${c.id}:${c.partial}:${c.revisionDate?.getTime()}`)
      .sort()
      .join();
    if (!this.sortedCiphersCache.isCached(url) || this.cachedSignatures.get(url) !== signature) {
      this.sortedCiphersCache.addCiphers(url, ciphers);
      this.cachedSignatures.set(url, signature);
    }
    return this.sortedCiphersCache.getNext(url) ?? undefined;
  }

  /** Advances both the stored and the revealed rotation. */
  override advanceRotation(url: string): void {
    super.advanceRotation(url);
    this.sortedCiphersCache.updateLastUsedIndex(url);
  }

  /** False when the username, password, or new password of the form is a revealed login for its URL. */
  override async canOfferSave(form: SaveCandidate, userId: UserId): Promise<boolean> {
    const username = form.username?.toLowerCase();
    const passwords = [form.password, form.newPassword].filter((p) => !!p);
    const matches = (await this.getRevealed(userId)).filter((c) => {
      const usernameMatches = !!username && c.login?.username?.toLowerCase() === username;
      const passwordMatches = !!c.login?.password && passwords.includes(c.login.password);
      return usernameMatches || passwordMatches;
    });
    return (
      matches.length === 0 ||
      (await this.cipherService.filterCiphersForUrl(matches, form.uri)).length === 0
    );
  }

  private async getRevealed(userId: UserId): Promise<CipherView[]> {
    return [...(await firstValueFrom(this.revealedCipherService.revealed$(userId))).values()];
  }
}

/**
 * Appends the revealed views. The stored lookups exclude restricted ciphers, so a stored copy of
 * the same ID is no longer restricted and wins over its old revealed view.
 */
function withRevealed(ciphers: CipherView[], revealed: CipherView[]): CipherView[] {
  const ids = new Set(ciphers.map((cipher) => cipher.id));
  return ciphers.concat(revealed.filter((view) => !ids.has(view.id)));
}
