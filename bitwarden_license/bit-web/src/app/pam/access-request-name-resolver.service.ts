import { Injectable, inject } from "@angular/core";
import {
  Observable,
  combineLatestWith,
  distinctUntilChanged,
  firstValueFrom,
  from,
  map,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Resolves the cipher and collection display names for access-request rows from
 * local vault state.
 *
 * An access-rule-gated cipher syncs to the vault of anyone who governs or requested
 * it as a partial CipherView (name already decrypted by CipherService), and its
 * collection is a CollectionView — so names are read from there, keyed by id. Shared by
 * the requester's own request list and the approver inbox. No other Vault Data passes through here.
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
   * emits. Drives {@link resolveNames$}.
   */
  private readonly liveCollectionNames$: Observable<Map<string, string>> =
    this.collectionNames$().pipe(
      startWith(new Map<string, string>()),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  /**
   * Reactive cipher + collection name lookup for a changing set of refs (an access request's
   * `{ cipherId, collectionId }`). Cipher names and the decrypted views resolve from a vault snapshot
   * taken each time the ref set changes; collection names additionally re-emit as local collection
   * state warms — so rows fill in regardless of whether the caller's vault was warm when they loaded.
   *
   * Callers build their display rows by reading the returned maps (`cipherNameById`,
   * `collectionNameById`, `cipherById`). An unchanged ref set (e.g. an optimistic status edit that
   * keeps the same ids) does not re-decrypt. Shared per subscriber.
   */
  resolveNames$(
    refs$: Observable<ReadonlyArray<{ cipherId: string; collectionId: string }>>,
  ): Observable<ResolvedNames> {
    return refs$.pipe(
      distinctUntilChanged(sameRefs),
      switchMap((refs) => from(this.namesFor(refs))),
      combineLatestWith(this.liveCollectionNames$),
      map(([snapshot, liveCollections]) =>
        liveCollections.size === 0
          ? snapshot
          : {
              ...snapshot,
              collectionNameById: new Map<string, string>([
                ...snapshot.collectionNameById,
                ...liveCollections,
              ]),
            },
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
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

/** An empty name lookup — the graceful default before a vault snapshot resolves (ids stand in). */
export function emptyResolvedNames(): ResolvedNames {
  return {
    cipherNameById: new Map(),
    collectionNameById: new Map(),
    cipherById: new Map(),
  };
}

/**
 * Merge two resolved-name lookups into one (later entries win). Lets a surface that draws from more
 * than one loader — e.g. the audit log, which unions the approver decision history with the viewer's
 * own requests — resolve names for the combined set from both loaders' snapshots.
 */
export function mergeResolvedNames(a: ResolvedNames, b: ResolvedNames): ResolvedNames {
  return {
    cipherNameById: new Map([...a.cipherNameById, ...b.cipherNameById]),
    collectionNameById: new Map([...a.collectionNameById, ...b.collectionNameById]),
    cipherById: new Map([...a.cipherById, ...b.cipherById]),
  };
}

/**
 * Whether two ref sets name the same `{ cipherId, collectionId }` pairs (order-insensitive), so
 * {@link AccessRequestNameResolver.resolveNames$} can skip a redundant vault decrypt when an
 * optimistic status edit re-emits the same requests.
 */
function sameRefs(
  a: ReadonlyArray<{ cipherId: string; collectionId: string }>,
  b: ReadonlyArray<{ cipherId: string; collectionId: string }>,
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const key = (refs: ReadonlyArray<{ cipherId: string; collectionId: string }>): string =>
    refs
      .map((ref) => `${ref.cipherId}:${ref.collectionId}`)
      .sort()
      .join("|");
  return key(a) === key(b);
}
