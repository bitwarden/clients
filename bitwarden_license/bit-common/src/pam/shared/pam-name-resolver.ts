import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

/** Looks a name up by id, answering the id itself when no name is known. */
export interface PamNames {
  cipher(id: string): string;
  collection(id: string): string;
  organization(id: string): string;
}

export const PAM_IDS_ONLY: PamNames = Object.freeze({
  cipher: (id: string) => id,
  collection: (id: string) => id,
  organization: (id: string) => id,
});

/**
 * Resolves cipher, collection and organization names for display, for commands run with
 * `--names`. It reads only the synced vault, so it never makes a request, and an id with no
 * match, such as a cipher the server withholds from the CLI while it is gated, falls back to the
 * id. The names are decrypted vault data: print them to stdout only, and never log them.
 */
export class PamNameResolver {
  constructor(
    private cipherService: CipherService,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  /** Reads the vault once and returns a lookup. Any failure degrades to ids, without logging. */
  async load(): Promise<PamNames> {
    let userId;
    try {
      userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    } catch {
      return PAM_IDS_ONLY;
    }

    const [ciphers, collections, organizations] = await Promise.all([
      this.read(async () => await this.cipherService.getAllDecrypted(userId)),
      this.read(
        async () => await firstValueFrom(this.collectionService.decryptedCollections$(userId)),
      ),
      this.read(async () => await firstValueFrom(this.organizationService.organizations$(userId))),
    ]);

    const toMap = (items: { id?: string; name?: string }[]) =>
      new Map(items.filter((i) => i.id && i.name).map((i) => [i.id as string, i.name as string]));
    const cipherNames = toMap(ciphers);
    const collectionNames = toMap(collections);
    const organizationNames = toMap(organizations);

    return {
      cipher: (id) => cipherNames.get(id.toLowerCase()) ?? id,
      collection: (id) => collectionNames.get(id.toLowerCase()) ?? id,
      organization: (id) => organizationNames.get(id.toLowerCase()) ?? id,
    };
  }

  private async read<T>(fn: () => Promise<T[]>): Promise<T[]> {
    try {
      return (await fn()) ?? [];
    } catch {
      // The error may describe vault data, so it is neither logged nor surfaced.
      return [];
    }
  }
}
