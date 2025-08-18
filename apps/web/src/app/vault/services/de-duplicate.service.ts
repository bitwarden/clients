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
// Success dialog replaced by callout shown in the de-duplicate component

export interface DuplicateOperationResult {
  setsFound: number;
  trashed: number;
  permanentlyDeleted: number;
}

interface DuplicateSet {
  key: string;
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
  async findAndHandleDuplicates(userId: UserId): Promise<DuplicateOperationResult> {
    const allCiphers = await this.cipherService.getAllDecrypted(userId);
    const duplicateSets = this.findDuplicateSets(allCiphers);

    if (duplicateSets.length > 0) {
      const { trashed, permanentlyDeleted } = await this.handleDuplicates(duplicateSets, userId);
      return { setsFound: duplicateSets.length, trashed, permanentlyDeleted };
    }
    return { setsFound: 0, trashed: 0, permanentlyDeleted: 0 };
  }

  /**
   * Finds groups of ciphers (clusters) that are considered duplicates.
   * A "group" or cluster is defined by ciphers sharing login.username and a normalized login.uri,
   * OR a matching login.username and normalized cipher.name,
   * OR when no username is present, on matching normalized cipher.name only.
   * @param ciphers A list of all the user's ciphers.
   * @returns An array of DuplicateSet objects, each representing a group of duplicates.
   */
  private findDuplicateSets(ciphers: CipherView[]): DuplicateSet[] {
    const uriBuckets = new Map<string, CipherView[]>();
    const nameBuckets = new Map<string, CipherView[]>();
    const nameOnlyBuckets = new Map<string, CipherView[]>(); // used in edge cases when no useername is present for a login

    // DuplicateSet will be created to hold duplicate login ciphers as soon as two matching ci\hers appear in a bucket
    const duplicateSets: DuplicateSet[] = [];

    // Used to prevent redundant groupings for a given display key ['username+uri', 'username+name']
    // Note that matchings based solely on name (no username for login) will share the 'username+name' display key
    const setByDisplayKey = new Map<string, DuplicateSet>();

    /**
     * When a bucket first qualifies as a duplicate (size === 2), create a single DuplicateSet,
     * register it by displayKey to prevent redundant groupings, and reuse the bucket array
     * so later additions are reflected.
     *
     * @param bucket Accumulated ciphers for this grouping key.
     * @param displayKey Human-friendly label identifying the group.
     */
    const ensureSetForBucket = (bucket: CipherView[], displayKey: string): void => {
      if (bucket.length === 2 && !setByDisplayKey.has(displayKey)) {
        const ds: DuplicateSet = { key: displayKey, ciphers: bucket };
        setByDisplayKey.set(displayKey, ds);
        duplicateSets.push(ds);
      }
    };

    for (const cipher of ciphers) {
      const username = cipher.login?.username?.trim() || "";

      // Match URIs when username is present
      // Almost all dudplicates can be identified by matching username and URI - other cases handled in next block
      if (username) {
        const uris = this.extractUriStrings(cipher);
        if (uris.length > 0) {
          // Collect unique normalized hosts to avoid adding the same cipher twice to the same bucket
          const hosts = new Set<string>();
          for (const uri of uris) {
            const normHost = this.normalizeUri(uri);
            if (normHost) {
              hosts.add(normHost);
            }
          }
          for (const normHost of hosts) {
            const key = `${username}||${normHost}`;
            let bucket = uriBuckets.get(key);
            if (!bucket) {
              bucket = [];
              uriBuckets.set(key, bucket);
            }
            bucket.push(cipher);
            const displayKey = `username+uri: ${username} @ ${normHost}`;
            ensureSetForBucket(bucket, displayKey); // Create/extend duplicate set when bucket reaches size 2
          }
        }
      }

      // Match on names, with or without usernames
      const rawName = cipher.name?.trim();
      if (rawName) {
        const canonical = this.canonicalizeName(rawName);
        if (canonical) {
          if (username) {
            const key = `${username}||${canonical}`;
            let bucket = nameBuckets.get(key);
            if (!bucket) {
              bucket = [];
              nameBuckets.set(key, bucket);
            }
            bucket.push(cipher);
            const displayName = bucket[0].name?.trim() || "";
            const displayKey = `username+name: ${username} & ${displayName}`;
            ensureSetForBucket(bucket, displayKey); // Create/extend duplicate set when bucket reaches size 2
          } else {
            // match on cipher.name only when username is absent
            // to prevent false positive duplicates in a situation where a user has multiple accounts on the same site - among others
            let bucket = nameOnlyBuckets.get(canonical);
            if (!bucket) {
              bucket = [];
              nameOnlyBuckets.set(canonical, bucket);
            }
            bucket.push(cipher);
            const displayName = bucket[0].name?.trim() || "";
            // Reuse existing display format so UI logic extracts the name without introducing new labels
            const displayKey = `username+name:  & ${displayName}`;
            ensureSetForBucket(bucket, displayKey); // Create/extend duplicate set when bucket reaches size 2
          }
        }
      }
    }

    // Collapse groups that contain the exact same cipher IDs
    // Prefer the stronger username+uri grouping over username+name
    const weightedDuplicateSets = new Map<string, DuplicateSet>(); // used to prioritize username+uri ses
    const groupingPriority = (key: string): number => (key.startsWith("username+uri:") ? 2 : 1);

    for (const set of duplicateSets) {
      const signature = set.ciphers
        .map((c) => c.id)
        .sort()
        .join("|"); // string representing ciphr IDs in a reproducible way
      const existing = weightedDuplicateSets.get(signature);
      if (!existing || groupingPriority(set.key) > groupingPriority(existing.key)) {
        weightedDuplicateSets.set(signature, set);
      }
    }

    return Array.from(weightedDuplicateSets.values());
  }

  /**
   * Produce a canonical form of a name for duplicate comparison:
   *  - Remove ALL whitespace characters (internal & external).
   *  - Lowercase the result.
   *  - Return empty string if nothing remains.
   */
  private canonicalizeName(name: string): string {
    return name.replace(/\s+/g, "").toLowerCase();
  }

  /**
   * Returns all URI strings from a login.
   * Handles both string and object entries in the `uris` array.
   * Ignores empty or invalid entries.
   *
   * @param cipher The cipher to extract URIs from.
   * @returns Array of URI strings.
   */
  private extractUriStrings(cipher: CipherView): string[] {
    const uris = (cipher.login as any)?.uris;
    if (!uris || !Array.isArray(uris)) {
      return [];
    }
    const out: string[] = [];
    for (const entry of uris) {
      if (!entry) {
        continue;
      }
      if (typeof entry === "string") {
        out.push(entry);
      } else if (typeof entry === "object") {
        const value = (entry.uri ?? entry.decryptedValue ?? entry.text ?? "") as string;
        if (typeof value === "string" && value.trim().length > 0) {
          out.push(value);
        }
      }
    }
    return out;
  }

  /**
   * Extracts the host portion (subdomains.domain.tld OR IPv4 OR IPv6) from an input string.
   * Behavior:
   *  - Prepends "https://" if the string lacks a scheme so standard parsing works.
   *  - Uses the node's URL parser when available (new URL). That yields punycoded ASCII for IDNs.
   *  - Falls back to a lightweight regex authority parse if URL parsing fails or isn't available.
   *  - Strips userinfo, port, enclosing IPv6 brackets, and a trailing dot; lowercases result.
   *  - Returns "" if a host can't be derived.
   * @param raw Input possibly containing a host.
   * @returns Host string or empty string.
   */
  private normalizeUri(raw: string): string {
    if (!raw) {
      return "";
    }
    let input = raw.trim();
    if (!input) {
      return "";
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
      input = "https://" + input;
    }
    // Attempt extraction using node's URL lib
    try {
      const url = new URL(input);
      let host = url.hostname || ""; // hostname excludes port already
      if (!host) {
        return "";
      }
      // Strip IPv6 brackets
      if (host.startsWith("[") && host.endsWith("]")) {
        host = host.slice(1, -1);
      }
      host = host.replace(/\.$/, "").toLowerCase();
      return host;
    } catch {
      // Fallback: manual authority extraction
      const authorityMatch = input.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
      if (!authorityMatch) {
        return "";
      }
      let authority = authorityMatch[1];
      // Strip userinfo if present (user:pass@host)
      const atIndex = authority.lastIndexOf("@");
      if (atIndex !== -1) {
        authority = authority.slice(atIndex + 1);
      }
      // IPv6 brackets
      if (authority.startsWith("[") && authority.includes("]")) {
        authority = authority.slice(1, authority.indexOf("]"));
      } else {
        // Port (last colon, numeric part)
        const c = authority.lastIndexOf(":");
        if (c !== -1 && /^[0-9]+$/.test(authority.slice(c + 1))) {
          authority = authority.slice(0, c);
        }
      }
      authority = authority.replace(/\.$/, "").toLowerCase();
      return authority;
    }
  }

  /**
   * Handles the user interaction and server-side deletion of identified duplicates.
   * This method prompts the user, checks permissions, and performs batch deletions.
   * @param duplicateSets The groups of duplicate ciphers found earlier.
   * @param userId The ID of the current user.
   */
  private async handleDuplicates(
    duplicateSets: DuplicateSet[],
    userId: UserId,
  ): Promise<{ trashed: number; permanentlyDeleted: number }> {
    // 1. Open the dialog to let the user review and select duplicates to delete.
    const dialogRef = DuplicateReviewDialogComponent.open(this.dialogService, {
      duplicateSets,
    });

    const result: DuplicateReviewDialogResult | undefined = await firstValueFrom(dialogRef.closed);
    if (!result?.confirmed || result.deleteCipherIds.length === 0) {
      return { trashed: 0, permanentlyDeleted: 0 };
    }

    // Avoid double-processing the same cipher when it appears in multiple duplicate sets
    const uniqueDeleteIds = Array.from(new Set(result.deleteCipherIds));

    // 2. Create a quick lookup map for the ciphers to be deleted.
    const cipherIndex = new Map<string, CipherView>();
    for (const set of duplicateSets) {
      for (const c of set.ciphers) {
        cipherIndex.set(c.id, c);
      }
    }

    // 3. Filter the user's selected deletions based on their permissions.
    // TODO: Determine why a user may not have permission to delete a cipher and explore ways of notifying them of this situation
    const permissionChecks = uniqueDeleteIds.map(async (id) => {
      const cipher = cipherIndex.get(id);
      if (!cipher) {
        return null;
      }
      const canDelete = await firstValueFrom(
        this.cipherAuthorizationService.canDeleteCipher$(cipher),
      );
      return canDelete ? cipher : null;
    });
    const permitted = (await Promise.all(permissionChecks)).filter(
      (c): c is CipherView => c != null,
    );
    if (permitted.length === 0) {
      return { trashed: 0, permanentlyDeleted: 0 };
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

    // 6. Return summary to display in a callout by the caller.
    return { trashed: toSoftDelete.length, permanentlyDeleted: toPermanentlyDelete.length };
  }
}
