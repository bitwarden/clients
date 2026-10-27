import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { SortedCiphersCache } from "@bitwarden/common/vault/models/domain/sorted-ciphers-cache";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Cipher lookups that also include revealed views (see {@link RevealedCipherService}). Only fills
 * a user starts use them: the inline menu, the context menu, the keyboard shortcut, and the popup
 * fill. Page-load fill, auto-submit, and save prompts never do.
 *
 * With no revealed views, each lookup gives the same result as its `CipherService` counterpart.
 */
export class RevealedAutofillCipherService {
  /** The keyboard shortcut rotation, used only while the user has revealed views. */
  private readonly sortedCiphersCache: SortedCiphersCache;
  /** The ciphers each cached URL was built from, so a change rebuilds the rotation. */
  private readonly cachedSignatures = new Map<string, string>();

  constructor(
    private readonly cipherService: CipherService,
    private readonly revealedCipherService: RevealedCipherService,
  ) {
    this.sortedCiphersCache = new SortedCiphersCache((a, b) =>
      this.cipherService.sortCiphersByLastUsed(a, b),
    );
  }

  /** The user's live revealed views. */
  async getRevealed(userId: UserId): Promise<CipherView[]> {
    return [...(await firstValueFrom(this.revealedCipherService.revealed$(userId))).values()];
  }

  /** {@link CipherService.getAllDecrypted} plus the revealed views. For a fill by cipher ID. */
  async getAllDecryptedIncludingRevealed(userId: UserId): Promise<CipherView[]> {
    const [ciphers, revealed] = await Promise.all([
      this.cipherService.getAllDecrypted(userId),
      this.getRevealed(userId),
    ]);
    return withRevealed(ciphers, revealed);
  }

  /** {@link CipherService.getAllDecryptedForUrl} plus the revealed views that match the URL. */
  async getAllDecryptedForUrlIncludingRevealed(
    url: string,
    userId: UserId,
    includeOtherTypes?: CipherType[],
  ): Promise<CipherView[]> {
    const [ciphers, revealed] = await Promise.all([
      this.cipherService.getAllDecryptedForUrl(url, userId, includeOtherTypes),
      this.getRevealed(userId),
    ]);
    if (revealed.length === 0) {
      return ciphers;
    }
    const matching = await this.cipherService.filterCiphersForUrl(revealed, url, includeOtherTypes);
    return withRevealed(ciphers, matching);
  }

  /** {@link CipherService.getNextCipherForUrl}, with the revealed views in the rotation. */
  async getNextCipherForUrlIncludingRevealed(
    url: string,
    userId: UserId,
  ): Promise<CipherView | undefined> {
    if ((await this.getRevealed(userId)).length === 0) {
      return (await this.cipherService.getNextCipherForUrl(url, userId)) ?? undefined;
    }

    const ciphers = await this.getAllDecryptedForUrlIncludingRevealed(url, userId);
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

  /** {@link CipherService.updateLastUsedIndexForUrl} for both rotations. */
  updateLastUsedIndexForUrl(url: string): void {
    this.cipherService.updateLastUsedIndexForUrl(url);
    this.sortedCiphersCache.updateLastUsedIndex(url);
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
