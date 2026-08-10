import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Cipher + collection display names (and the decrypted cipher views, for the item favicon)
 * resolved from local vault state, keyed by the raw (string) id. All three maps hold only what
 * this client could resolve; a missing entry means the id isn't in the caller's local vault (or
 * collection state wasn't warm), and callers fall back to the raw id / render no favicon.
 */
export type ResolvedNames = {
  cipherNameById: Map<string, string>;
  collectionNameById: Map<string, string>;
  /** The decrypted cipher views themselves, keyed by id — the source for favicon rendering. */
  cipherById: Map<string, CipherView>;
};

/** An empty name lookup — the graceful default before a vault snapshot resolves. */
export function emptyResolvedNames(): ResolvedNames {
  return { cipherNameById: new Map(), collectionNameById: new Map(), cipherById: new Map() };
}

/**
 * One-shot cipher + collection display-name (and favicon) lookup for the "My access" page and its
 * request-detail route, resolved from local vault state. An access-rule-gated cipher syncs to the
 * vault of anyone who requested it as a partial {@link CipherView} (name already decrypted by
 * {@link CipherService}), and its collection as a {@link CollectionView} — so names and the view
 * are read from there, keyed by id. No decryption happens here — only already-decrypted local
 * state is read — and no other Vault Data passes through this service.
 *
 * Deliberately a plain one-shot `Promise` (not the poc's reactive/backfill machinery): both
 * callers re-resolve names on every fetch, so a live subscription buys nothing here.
 */
@Injectable()
export class AccessNameResolverService {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);

  /**
   * Resolve cipher and collection display names (and cipher views) for the given refs from local
   * vault state. Unresolvable ids (not in the caller's vault, or collection state not yet warm)
   * are simply absent from the returned maps — callers fall back to the raw id.
   */
  async resolveNames(
    refs: ReadonlyArray<{ cipherId: string; collectionId: string }>,
  ): Promise<ResolvedNames> {
    if (refs.length === 0) {
      return emptyResolvedNames();
    }
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherIds = [...new Set(refs.map((ref) => ref.cipherId))];
    const [cipherViews, collections] = await Promise.all([
      this.cipherService.getAllDecryptedForIds(userId, cipherIds),
      firstValueFrom(this.collectionService.decryptedCollections$(userId)),
    ]);
    return {
      cipherNameById: new Map(cipherViews.map((view) => [view.id, view.name])),
      collectionNameById: new Map(
        collections.map((collection) => [collection.id, collection.name]),
      ),
      cipherById: new Map(cipherViews.map((view) => [view.id, view])),
    };
  }
}
