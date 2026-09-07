import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { AccessRequestView } from "../abstractions/access-lease";

/**
 * Cipher + collection + organization display names (and decrypted cipher views, for the item
 * favicon) resolved from local vault state, keyed by raw id. A missing entry means the id isn't
 * in the caller's local vault; callers fall back to the raw id or render nothing.
 */
export type ResolvedNames = {
  cipherNameById: Map<string, string>;
  collectionNameById: Map<string, string>;
  organizationNameById: Map<string, string>;
  /** The decrypted cipher views themselves, keyed by id — the source for favicon rendering. */
  cipherById: Map<string, CipherView>;
};

/** An empty name lookup — the graceful default before a vault snapshot resolves. */
export function emptyResolvedNames(): ResolvedNames {
  return {
    cipherNameById: new Map(),
    collectionNameById: new Map(),
    organizationNameById: new Map(),
    cipherById: new Map(),
  };
}

/**
 * The owning organization's display name for a request, or null when the server omitted the id
 * or membership doesn't name it. Never the raw uuid, since that tells an approver nothing.
 */
export function organizationNameFor(
  request: Pick<AccessRequestView, "organizationId">,
  names: ResolvedNames,
): string | null {
  const organizationId = request.organizationId;
  return organizationId == null
    ? null
    : (names.organizationNameById.get(uuidAsString(organizationId)) ?? null);
}

/**
 * One-shot cipher + collection + organization display-name (and favicon) lookup for the "My
 * access" page and its request-detail route, resolved from local vault state — no decryption
 * happens here, only already-decrypted local state is read.
 *
 * The read MUST go through `getAllDecryptedForIdsIncludingPartials`: every id here names a gated
 * cipher, and the default accessors strip partials, so using one resolves nothing at all.
 *
 * Deliberately a plain one-shot `Promise`: both callers re-resolve names on every fetch, so a
 * live subscription buys nothing here.
 */
@Injectable()
export class AccessNameResolverService {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly organizationService = inject(OrganizationService);

  /**
   * Resolve cipher, collection and organization display names (and cipher views) for the given refs
   * from local vault state. Unresolvable ids (not in the caller's vault, or collection state not yet
   * warm) are simply absent from the returned maps — callers fall back to the raw id.
   */
  async resolveNames(
    refs: ReadonlyArray<{ cipherId: string; collectionId: string }>,
  ): Promise<ResolvedNames> {
    if (refs.length === 0) {
      return emptyResolvedNames();
    }
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherIds = [...new Set(refs.map((ref) => ref.cipherId))];
    // Organizations are keyed off the caller's whole membership; a ref carries no organization id.
    const [cipherViews, collections, organizations] = await Promise.all([
      this.cipherService.getAllDecryptedForIdsIncludingPartials(userId, cipherIds),
      firstValueFrom(this.collectionService.decryptedCollections$(userId)),
      firstValueFrom(this.organizationService.organizations$(userId)),
    ]);
    return {
      cipherNameById: new Map(cipherViews.map((view) => [view.id, view.name])),
      collectionNameById: new Map(
        collections.map((collection) => [collection.id, collection.name]),
      ),
      organizationNameById: new Map(
        organizations.map((organization) => [organization.id, organization.name]),
      ),
      cipherById: new Map(cipherViews.map((view) => [view.id, view])),
    };
  }
}
