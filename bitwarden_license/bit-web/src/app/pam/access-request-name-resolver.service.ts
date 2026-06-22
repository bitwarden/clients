import { Injectable, inject } from "@angular/core";
import {
  Observable,
  combineLatest,
  firstValueFrom,
  map,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

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
   * The live collection-id → name map from local vault state, seeded with an empty map so consumers
   * paint immediately (with cipher names) before collection state is warm, and shared so any number
   * of subscribers drive a single decryption. The real names back-fill when {@link collectionNames$}
   * emits. Drives {@link applyCollectionNames$}.
   */
  private readonly liveCollectionNames$: Observable<Map<string, string>> =
    this.collectionNames$().pipe(
      startWith(new Map<string, string>()),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

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

  /**
   * Reactively fill `collectionName` on a stream of rows from local collection state, re-applying
   * whenever either the rows or that state changes — so names appear regardless of whether the rows
   * load before or after collection state warms up. Names are filled in place (the rows may be
   * response class instances that can't be cloned), then a fresh array is emitted so change
   * detection sees the update. Shared by the requester's list and the approver inbox.
   */
  applyCollectionNames$<T extends { collectionId: string; collectionName: string | null }>(
    rows$: Observable<T[]>,
  ): Observable<T[]> {
    return combineLatest([rows$, this.liveCollectionNames$]).pipe(
      map(([rows, names]) => {
        fillCollectionNames(rows, names);
        return rows.slice();
      }),
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
 * Fill in collection names on rows in place from the latest collection-state lookup, without
 * clobbering a name already resolved (the map only ever gains entries as collection state warms).
 * Backs {@link AccessRequestNameResolver.applyCollectionNames$}.
 */
export function fillCollectionNames(
  items: ReadonlyArray<{ collectionId: string; collectionName: string | null }>,
  names: Map<string, string>,
): void {
  for (const item of items) {
    const name = names.get(item.collectionId);
    if (name != null) {
      item.collectionName = name;
    }
  }
}
