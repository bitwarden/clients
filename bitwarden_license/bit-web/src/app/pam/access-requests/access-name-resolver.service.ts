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
 * Display names from local vault state, keyed by raw id. A missing entry means the id isn't in the
 * caller's vault; callers fall back to the raw id or render nothing.
 */
export type ResolvedNames = {
  cipherNameById: Map<string, string>;
  collectionNameById: Map<string, string>;
  organizationNameById: Map<string, string>;
  /** The decrypted cipher views, for favicons. */
  cipherById: Map<string, CipherView>;
};

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
 * Reads through `getAllDecryptedForIdsIncludingPartials`, since every id names a gated cipher and
 * the default accessors strip partials. A one-shot `Promise`, since callers re-resolve on every
 * fetch.
 */
@Injectable()
export class AccessNameResolverService {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly organizationService = inject(OrganizationService);

  /** Ids missing from the caller's vault, or from collection state not yet warm, are absent. */
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
