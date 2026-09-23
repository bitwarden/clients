import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

export type BulkDeleteCiphersParams = {
  cipherIds: string[];
  /** Unassigned org ciphers, deleted through the admin endpoint. */
  unassignedCiphers: string[];
  /** When true, ciphers are permanently deleted; otherwise they are sent to the trash. */
  permanent: boolean;
  /** Set when deleting org ciphers, to drive the admin endpoint routing. */
  organization?: Organization;
};

/**
 * Carries out the bulk deletion of vault items — ciphers and collections — from the server and local
 * state.
 *
 * Scoped to the deletion mechanics only: callers must verify the user is allowed to delete the items
 * and show any success/error feedback themselves.
 */
@Injectable({ providedIn: "root" })
export class BulkDeleteService {
  private readonly cipherService = inject(CipherService);
  private readonly apiService = inject(ApiService);
  private readonly collectionService = inject(CollectionService);
  private readonly syncService = inject(SyncService);
  private readonly accountService = inject(AccountService);

  /**
   * Deletes the given ciphers, routing through the admin endpoint where required: unassigned ciphers
   * (when the user can edit them) and all ciphers for an organization the user can edit fully.
   */
  async deleteCiphers({
    cipherIds,
    unassignedCiphers,
    permanent,
    organization,
  }: BulkDeleteCiphersParams): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const deletePromises: Promise<void>[] = [];

    if (unassignedCiphers.length && organization?.canEditUnassignedCiphers) {
      deletePromises.push(
        this.deleteCiphersWithServer(unassignedCiphers, userId, permanent, true, organization.id),
      );
    }

    if (cipherIds.length) {
      if (!organization || !organization.canEditAllCiphers) {
        deletePromises.push(
          this.deleteCiphersWithServer(
            cipherIds,
            userId,
            permanent,
            organization?.canEditAllCiphers,
          ),
        );
      } else {
        deletePromises.push(
          this.deleteCiphersWithServer(cipherIds, userId, permanent, true, organization.id),
        );
      }
    }

    await Promise.all(deletePromises);
  }

  /**
   * Deletes the given collections, batching the server requests by organization so each org is
   * deleted in a single call. A full sync follows because removing a collection mutates the ciphers
   * it contained, and local state is cleared so the change is reflected before the next sync settles.
   */
  async deleteCollections(collections: CollectionView[]): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const collectionIdsByOrg = new Map<string, string[]>();
    for (const collection of collections) {
      const ids = collectionIdsByOrg.get(collection.organizationId) ?? [];
      ids.push(collection.id);
      collectionIdsByOrg.set(collection.organizationId, ids);
    }

    await Promise.all(
      [...collectionIdsByOrg].map(([organizationId, collectionIds]) =>
        this.apiService.deleteManyCollections(organizationId, collectionIds),
      ),
    );

    await this.syncService.fullSync(true);
    await this.collectionService.delete(
      collections.map((c) => c.id as CollectionId),
      userId,
    );
  }

  private async deleteCiphersWithServer(
    ids: string[],
    userId: UserId,
    permanent: boolean,
    asAdmin?: boolean,
    organizationId?: OrganizationId,
  ): Promise<void> {
    if (permanent) {
      await this.cipherService.deleteManyWithServer(ids, userId, asAdmin, organizationId);
    } else {
      await this.cipherService.softDeleteManyWithServer(ids, userId, asAdmin, organizationId);
    }
  }
}
