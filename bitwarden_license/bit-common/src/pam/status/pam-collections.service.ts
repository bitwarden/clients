import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

export interface PamCollectionSummary {
  id: string;
  organizationId: string;
  name: string;
  /** The governed marker: the collection has an enabled access rule. */
  hasEnabledAccessRule: boolean;
}

/**
 * Lists the collections of one organization from the synced vault. It never calls the SDK or the
 * network. Names are decrypted vault data: print them to stdout only, and never log them.
 */
export class PamCollectionsService {
  constructor(
    private collectionService: CollectionService,
    private accountService: AccountService,
  ) {}

  async list(organizationId: string): Promise<PamCollectionSummary[]> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const collections = await firstValueFrom(this.collectionService.decryptedCollections$(userId));
    return collections
      .filter((c) => c.organizationId === organizationId)
      .map((c) => ({
        id: c.id,
        organizationId: c.organizationId,
        name: c.name,
        hasEnabledAccessRule: c.hasEnabledAccessRule === true,
      }));
  }
}
