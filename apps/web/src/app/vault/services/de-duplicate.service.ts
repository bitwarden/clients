import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService } from "@bitwarden/components";

import {
  DuplicateReviewDialogComponent,
  DuplicateReviewDialogResult,
} from "../../tools/de-duplicate/duplicate-review-dialog.component";
import {
  DuplicateSuccessDialogComponent,
  DuplicateSuccessDialogData,
} from "../../tools/de-duplicate/duplicate-success-dialog.component";

interface DuplicateSet {
  key: string; // identifies a group of duplicates (cluster)
  ciphers: CipherView[];
}

@Injectable({
  providedIn: "root",
})
export class DeDuplicateService {
  constructor(
    private cipherService: CipherService,
    private dialogService: DialogService,
    private cipherAuthorizationService: CipherAuthorizationService,
  ) {}

  /**
   * Main entry point to find and handle duplicate ciphers for a given user.
   * @param userId The ID of the current user.
   * @returns A promise that resolves to the number of duplicate sets found.
   */
  async findAndHandleDuplicates(userId: UserId): Promise<number> {
    const allCiphers = await this.cipherService.getAllDecrypted(userId);
    const duplicateSets = this.findDuplicateSets(allCiphers);

    if (duplicateSets.length > 0) {
      await this.handleDuplicates(duplicateSets, userId);
    }

    return duplicateSets.length;
  }

  /**
   * Finds groups of ciphers (clusters) that are considered duplicates.
   * @param ciphers A list of all the user's ciphers.
   * @returns An array of DuplicateSet objects, each representing a group of duplicates.
   */
  private findDuplicateSets(ciphers: CipherView[]): DuplicateSet[] {
    const duplicateSets: DuplicateSet[] = [];
    const consumed = new Set<string>(); // used to prevent redundant comparisons

    // 1. First pass: group by exact credential matches (username, password, org, folder).
    const credentialBuckets = this.buildCredentialBuckets(ciphers);
    for (const bucket of credentialBuckets.values()) {
      if (bucket.length < 2) {continue;}
      const { clusters } = this.groupByName(bucket);
      for (const cluster of clusters) {
        duplicateSets.push({ key: this.clusterKey(cluster), ciphers: cluster });
        cluster.forEach((c) => consumed.add(c.id));
      }
    }

    // 2. Second pass: Cluster remaining ciphers by a canonical name variant.
    // This catches duplicates with the same name/username but different passwords, in case import sources had unsynchronized passwords
    const nameBuckets = this.buildNameBuckets(ciphers, consumed);
    for (const bucket of nameBuckets.values()) {
      if (bucket.length < 2) {continue;}
      const { clusters } = this.groupByName(bucket);
      for (const cluster of clusters) {
        if (cluster.every((c) => consumed.has(c.id))) {continue;}
        duplicateSets.push({ key: this.clusterKey(cluster), ciphers: cluster });
        cluster.forEach((c) => consumed.add(c.id));
      }
    }

    return duplicateSets;
  }

  /**
   * Generates a display key for a cluster of duplicate ciphers.
   * The key is either the username or the name of the first cipher in the cluster.
   * @param cluster The group of ciphers.
   * @returns A string key for the cluster.
   */
  private clusterKey(cluster: CipherView[]): string {
    const first = cluster[0];
    return first.login?.username || first.name || "";
  }

  /**
   * Groups ciphers into "buckets" based on an exact match of their username, password, item name,
   * organization, and folder.
   * @param ciphers All the user's ciphers.
   * @returns A Map where keys are concatenated credential strings and values are lists of matching ciphers.
   */
  private buildCredentialBuckets(ciphers: CipherView[]) {
    const map = new Map<string, CipherView[]>();
    for (const cipher of ciphers) {
      const username = cipher.login?.username;
      const password = cipher.login?.password;
      if (!username || !password) {continue;}
      const key = `${username}|${password}|${cipher.organizationId || "noOrg"}|${cipher.folderId || "noFolder"}`;
      if (!map.has(key)) {map.set(key, []);}
      map.get(key)!.push(cipher);
    }
    return map;
  }

  /**
   * Normalizes a cipher's name by removing a trailing `(username)` suffix.
   * e.g., "My Site (harr1424)" becomes "My Site".
   * @param cipher The cipher to process.
   * @returns The canonical name string.
   */
  private canonicalName(cipher: CipherView): string {
    const username = cipher.login?.username || "";
    const name = cipher.name || "";
    const suffix = ` (${username})`;
    return username && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
  }

  /**
   * Groups ciphers into "buckets" based on their canonical name, username, organization, and folder.
   * It ignores ciphers that were already processed in the first pass (present in the 'consumed' set)
   * @param ciphers All the user's ciphers.
   * @param consumed A set of cipher IDs that have already been clustered.
   * @returns A Map where keys are concatenated name strings and values are lists of matching ciphers.
   */
  private buildNameBuckets(ciphers: CipherView[], consumed: Set<string>) {
    const map = new Map<string, CipherView[]>();
    for (const cipher of ciphers) {
      if (consumed.has(cipher.id)) {continue;}
      if (!cipher.login) {continue;}
      const base = this.canonicalName(cipher);
      const key = `${base}|${cipher.login.username || "noUser"}|${cipher.organizationId || "noOrg"}|${cipher.folderId || "noFolder"}`;
      if (!map.has(key)) {map.set(key, []);}
      map.get(key)!.push(cipher);
    }
    return map;
  }

  /**
   * A greedy algorithm to group a list of ciphers into clusters based on a name variant match.
   * This is used in both passes of the de-duplication logic.
   * @param list The list of ciphers to be clustered.
   * @returns An object containing `clusters` (groups of 2 or more ciphers) and `singles` (ciphers that didn't match anything).
   */
  private groupByName(list: CipherView[]): { clusters: CipherView[][]; singles: CipherView[] } {
    const unassigned = [...list];
    const clusters: CipherView[][] = [];
    const singles: CipherView[] = [];
    while (unassigned.length) {
      const seed = unassigned.shift()!;
      const cluster = [seed];
      for (let i = unassigned.length - 1; i >= 0; i--) {
        const candidate = unassigned[i];
        if (this.isDuplicateByName(seed, candidate)) {
          cluster.push(candidate);
          unassigned.splice(i, 1);
        }
      }
      if (cluster.length > 1) {clusters.push(cluster);}
      else {singles.push(seed);}
    }
    return { clusters, singles };
  }

  /**
   * Determines if two ciphers are duplicates based on a flexible name comparison.
   * It checks for an exact name match or a name with a `(username)` suffix.
   * @param cipher1 The first cipher.
   * @param cipher2 The second cipher.
   * @returns `true` if the ciphers are duplicates by name, `false` otherwise.
   */
  private isDuplicateByName(cipher1: CipherView, cipher2: CipherView): boolean {
    const username = cipher1.login?.username || "";
    return (
      cipher1.name === cipher2.name || // e.g.,
      cipher1.name === `${cipher2.name} (${username})` ||
      cipher2.name === `${cipher1.name} (${username})` //
    );
  }

  /**
   * Handles the user interaction and server-side deletion of identified duplicates.
   * This method prompts the user, checks permissions, and performs batch deletions.
   * @param duplicateSets The groups of duplicate ciphers found earlier.
   * @param userId The ID of the current user.
   */
  private async handleDuplicates(duplicateSets: DuplicateSet[], userId: UserId) {
    // 1. Open the dialog to let the user review and select duplicates to delete.
    const dialogRef = DuplicateReviewDialogComponent.open(this.dialogService, {
      duplicateSets,
    });
    const result: DuplicateReviewDialogResult | undefined = await firstValueFrom(dialogRef.closed);
    if (!result?.confirmed || result.deleteCipherIds.length === 0) {
      return;
    }

    // 2. Create a quick lookup map for the ciphers to be deleted.
    const cipherIndex = new Map<string, CipherView>();
    for (const set of duplicateSets) {
      for (const c of set.ciphers) {
        cipherIndex.set(c.id, c);
      }
    }

    // 3. Filter the user's selected deletions based on their permissions.
    // TODO: Determine why a user may not have permission to delete a cipher and explore ways of notifying them of this situation
    const permissionChecks = result.deleteCipherIds.map(async (id) => {
      const cipher = cipherIndex.get(id);
      if (!cipher) {return null;}
      const canDelete = await firstValueFrom(
        this.cipherAuthorizationService.canDeleteCipher$(cipher),
      );
      return canDelete ? cipher : null;
    });
    const permitted = (await Promise.all(permissionChecks)).filter(
      (c): c is CipherView => c != null,
    );
    if (permitted.length === 0) {
      return;
    }

    // 4. Separate permitted deletions into soft-delete (to trash) and permanent-delete.
    const toSoftDelete: string[] = [];
    const toPermanentlyDelete: string[] = [];
    for (const cipher of permitted) {
      if (cipher.isDeleted) {
        toPermanentlyDelete.push(cipher.id);
      } else {
        toSoftDelete.push(cipher.id);
      }
    }

    // 5. Perform the server-backed deletions in batches to avoid payload limits of > 500 ciphers
    const BATCH_SIZE = 500;
    const processBatches = async (
      ids: string[],
      action: (batch: string[]) => Promise<any>,
    ): Promise<void> => {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const slice = ids.slice(i, i + BATCH_SIZE);
        if (slice.length) {
          await action(slice);
        }
      }
    };

    if (toSoftDelete.length > 0) {
      await processBatches(toSoftDelete, (batch) =>
        this.cipherService.softDeleteManyWithServer(batch, userId),
      );
    }
    if (toPermanentlyDelete.length > 0) {
      await processBatches(toPermanentlyDelete, (batch) =>
        this.cipherService.deleteManyWithServer(batch, userId),
      );
    }

    // 6. Show a summary dialog if any deletions occurred.
    const summary: DuplicateSuccessDialogData = {
      trashed: toSoftDelete.length,
      permanentlyDeleted: toPermanentlyDelete.length,
    };
    if (summary.trashed > 0 || summary.permanentlyDeleted > 0) {
      this.dialogService.open(DuplicateSuccessDialogComponent, { data: summary });
    }
  }
}
