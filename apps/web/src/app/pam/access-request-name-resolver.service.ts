import { Injectable, inject } from "@angular/core";
import { Observable, firstValueFrom, map, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AccessRequestDetailsResponse } from "@bitwarden/pam";

/**
 * Resolves the cipher and collection display names on access-request rows from
 * local vault state.
 *
 * An access-rule-gated cipher syncs to the vault of anyone who governs or requested
 * it as a partial CipherView (name already decrypted by CipherService), and its
 * collection is a CollectionView — so names are read from there rather than
 * decrypting the response's denormalized copies. Shared by the requester's own
 * request list and the approver inbox. No other Vault Data passes through here.
 */
@Injectable({ providedIn: "root" })
export class AccessRequestNameResolver {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);

  /**
   * Populate each row's `cipherName`/`collectionName` in place. The cipher name
   * falls back to the raw id and the collection name to null when the item isn't in
   * the caller's vault, so a stale row never renders an undecryptable blob.
   *
   * Returns the resolved lookup maps (including `cipherById`) so callers that already
   * pay for this vault snapshot can reuse the decrypted views — e.g. to render favicons —
   * without a second fetch.
   */
  async resolveDisplayNames(rows: AccessRequestDetailsResponse[]): Promise<ResolvedNames> {
    if (rows.length === 0) {
      return emptyResolvedNames();
    }
    const names = await this.namesFor(rows);
    for (const row of rows) {
      row.cipherName = names.cipherNameById.get(row.cipherId) ?? row.cipherId;
      row.collectionName = names.collectionNameById.get(row.collectionId) ?? null;
    }
    return names;
  }

  /**
   * Resolve cipher and collection display names for arbitrary references from local vault
   * state, returned as lookup maps. Used for types without writable name fields (e.g. leases),
   * which read from the maps directly. `cipherById` exposes the decrypted views themselves
   * (for favicon rendering). Does no work — and touches no services — for an empty list.
   */
  async namesFor(
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
      cipherNameById: new Map<string, string>(cipherViews.map((view) => [view.id, view.name])),
      collectionNameById: new Map<string, string>(
        collections.map((collection) => [collection.id, collection.name]),
      ),
      cipherById: new Map<string, CipherView>(cipherViews.map((view) => [view.id, view])),
    };
  }

  /**
   * A reactive collection-id → name lookup that re-emits whenever local collection state changes.
   *
   * Cipher names resolve on demand (see {@link namesFor}), but collection names come from the
   * decrypted-collection stream, which may not be warm when a page first loads. Subscribers can
   * re-apply collection names as this emits so they fill in without the user opening the vault.
   */
  collectionNames$(): Observable<Map<string, string>> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.collectionService.decryptedCollections$(userId)),
      map((collections) => new Map(collections.map((c) => [c.id, c.name]))),
    );
  }
}

/** Lookup maps resolved from a single local vault snapshot. */
export type ResolvedNames = {
  cipherNameById: Map<string, string>;
  collectionNameById: Map<string, string>;
  /** The decrypted cipher views, keyed by id — the source for favicon rendering. */
  cipherById: Map<string, CipherView>;
};

function emptyResolvedNames(): ResolvedNames {
  return {
    cipherNameById: new Map(),
    collectionNameById: new Map(),
    cipherById: new Map(),
  };
}

/**
 * Fill in collection names on rows from the latest {@link AccessRequestNameResolver.collectionNames$}
 * lookup, without clobbering a name already resolved (the map only ever gains entries as collection
 * state warms). Returns whether anything changed, so callers only re-emit when needed.
 *
 * Shared by the PAM data services, which subscribe to `collectionNames$()` and re-apply names to
 * their held rows as local collection state loads — without the user having to open the vault first.
 */
export function fillCollectionNames(
  items: ReadonlyArray<{ collectionId: string; collectionName: string | null }>,
  names: Map<string, string>,
): boolean {
  let changed = false;
  for (const item of items) {
    const name = names.get(item.collectionId);
    if (name != null && name !== item.collectionName) {
      item.collectionName = name;
      changed = true;
    }
  }
  return changed;
}
