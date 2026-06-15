import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
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
   */
  async resolveDisplayNames(rows: AccessRequestDetailsResponse[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const { cipherNameById, collectionNameById } = await this.namesFor(rows);
    for (const row of rows) {
      row.cipherName = cipherNameById.get(row.cipherId) ?? row.cipherId;
      row.collectionName = collectionNameById.get(row.collectionId) ?? null;
    }
  }

  /**
   * Resolve cipher and collection display names for arbitrary references from local vault
   * state, returned as lookup maps. Used for types without writable name fields (e.g. leases),
   * which read from the maps directly. Does no work — and touches no services — for an empty list.
   */
  async namesFor(
    refs: ReadonlyArray<{ cipherId: string; collectionId: string }>,
  ): Promise<{ cipherNameById: Map<string, string>; collectionNameById: Map<string, string> }> {
    if (refs.length === 0) {
      return { cipherNameById: new Map(), collectionNameById: new Map() };
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
    };
  }
}
