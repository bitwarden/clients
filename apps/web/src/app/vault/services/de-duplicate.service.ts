import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService } from "@bitwarden/components";

import {
  DuplicateReviewDialogComponent,
  DuplicateReviewDialogResult,
} from "../../tools/de-duplicate/duplicate-review-dialog.component";

export interface DuplicateOperationResult {
  setsFound: number;
  trashed: number;
  permanentlyDeleted: number;
  warnings?: DuplicateOperationWarnings;
}

export interface DuplicateOperationWarnings {
  exactFallbackCount: number;
  unparseableUriCount: number;
  permissionDeniedCount: number;
  unparseableUris?: string[];
  exactFallbackUris?: string[];
  permissionDeniedNames?: string[];
}

interface DuplicateSet {
  key: string;
  ciphers: CipherView[];
}

interface WarningAccumulator {
  exactFallbackCount: number;
  unparseableUriCount: number;
  permissionDeniedCount: number;
  unparseableUris: string[];
  exactFallbackUris: string[];
  permissionDeniedNames: string[];
}

export type UriMatchStrategy = "Base" | "Hostname" | "Host" | "Exact";

interface ParsedUri {
  original: string;
  androidPackage?: string;
  scheme?: string;
  hostname?: string;
  port?: string;
  path?: string;
  query?: string;
  fragment?: string;
  /** True when URL parsing fell back to a best-effort/manual parse (not fully exact). */
  approximate?: boolean;
  /** True when the input could not be parsed into a host/authority at all. */
  unparseable?: boolean;
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
   * Strategies for URI matching/normalization. The current implementation defaults to Base.
   *
   * Base: matches on second-level and top-level domain only
   * Hostname: matches on subdomain, second-level domain, and top-level domain
   * Host: matches on the above but also includes port, when available
   * Exact: exact match between URI and current browser page
   */
  private static readonly DEFAULT_URI_STRATEGY: UriMatchStrategy = "Base";

  private createWarningAccumulator(): WarningAccumulator {
    return {
      exactFallbackCount: 0,
      unparseableUriCount: 0,
      permissionDeniedCount: 0,
      unparseableUris: [],
      exactFallbackUris: [],
      permissionDeniedNames: [],
    };
  }

  private toWarningsResult(acc: WarningAccumulator): DuplicateOperationWarnings {
    return {
      exactFallbackCount: acc.exactFallbackCount,
      unparseableUriCount: acc.unparseableUriCount,
      permissionDeniedCount: acc.permissionDeniedCount,
      unparseableUris: acc.unparseableUris.length ? acc.unparseableUris : undefined,
      exactFallbackUris: acc.exactFallbackUris.length ? acc.exactFallbackUris : undefined,
      permissionDeniedNames: acc.permissionDeniedNames.length
        ? acc.permissionDeniedNames
        : undefined,
    };
  }

  /**
   * Main entry point to find and handle duplicate ciphers for a given user.
   * @param userId The ID of the current user.
   * @returns A promise that resolves to the number of duplicate sets found.
   */
  async findAndHandleDuplicates(
    userId: UserId,
    options?: { uriStrategy?: UriMatchStrategy },
  ): Promise<DuplicateOperationResult> {
    const uriStrategy = options?.uriStrategy ?? DeDuplicateService.DEFAULT_URI_STRATEGY;
    const allCiphers = await this.cipherService.getAllDecrypted(userId);
    const warningAccumulator = this.createWarningAccumulator();
    const duplicateSets = this.findDuplicateSets(allCiphers, uriStrategy, warningAccumulator);

    if (duplicateSets.length > 0) {
      const { trashed, permanentlyDeleted } = await this.handleDuplicates(
        duplicateSets,
        userId,
        warningAccumulator,
      );
      return {
        setsFound: duplicateSets.length,
        trashed,
        permanentlyDeleted,
        warnings: this.toWarningsResult(warningAccumulator),
      };
    }
    return {
      setsFound: 0,
      trashed: 0,
      permanentlyDeleted: 0,
      warnings: this.toWarningsResult(warningAccumulator),
    };
  }

  /**
   * Finds groups of ciphers (clusters) that are considered duplicates.
   * A "group" or cluster is defined by ciphers sharing login.username and a matched login.uri
   * (where match behavior is determined by DEFAULT_URI_STRATEGY)
   * OR a exact matching login.username and exact matching normalized cipher.name,
   * OR when no username is present, on exact matching normalized cipher.name only
   * where cipher name normalization involves stripping internal and external whitespace and lowercasing all characters.
   * @param ciphers A list of all the user's ciphers.
   * @returns An array of DuplicateSet objects, each representing a group of duplicates.
   */
  private findDuplicateSets(
    ciphers: CipherView[],
    uriStrategy: UriMatchStrategy = DeDuplicateService.DEFAULT_URI_STRATEGY,
    warningAccumulator?: WarningAccumulator,
  ): DuplicateSet[] {
    const uriBuckets = new Map<string, CipherView[]>();
    const nameBuckets = new Map<string, CipherView[]>();
    const nameOnlyBuckets = new Map<string, CipherView[]>(); // used in edge cases when no username is present for a login

    // DuplicateSet will be created to hold duplicate login ciphers once two matching ciphers appear in a bucket
    const duplicateSets: DuplicateSet[] = [];

    // Used to prevent redundant groupings for a given display key ['username+uri', 'username+name']
    // Note that matches based solely on name (no username for login) will share the 'username+name' display key
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
      // Almost all duplicates can be identified by matching username and URI - other cases handled in next block
      if (username) {
        const uris = this.extractUriStrings(cipher);
        if (uris.length > 0) {
          // Collect unique normalized keys to avoid adding the same cipher twice to the same bucket
          const keys = this.getUriKeysForStrategy(uris, uriStrategy, warningAccumulator);
          for (const k of keys) {
            const key = `${username}||${k}`;
            let bucket = uriBuckets.get(key);
            if (!bucket) {
              bucket = [];
              uriBuckets.set(key, bucket);
            }
            bucket.push(cipher);
            const displayKey = `username+uri: ${username} @ ${k}`;
            ensureSetForBucket(bucket, displayKey);
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
            ensureSetForBucket(bucket, displayKey);
          } else {
            // match on cipher.name only when login.username is absent
            // to prevent false positive duplicates in a situation where a user has multiple accounts on the same site - among others
            // this logic will apply to all cipher types, not only logins
            let bucket = nameOnlyBuckets.get(canonical);
            if (!bucket) {
              bucket = [];
              nameOnlyBuckets.set(canonical, bucket);
            }
            bucket.push(cipher);
            const displayName = bucket[0].name?.trim() || "";
            // Reuse existing display format so UI logic extracts the name without introducing new labels
            const displayKey = `username+name:  & ${displayName}`;
            ensureSetForBucket(bucket, displayKey);
          }
        }
      }
    }

    // Collapse groups that contain the exact same cipher IDs
    // Prefer the stronger username+uri grouping over username+name
    const weightedDuplicateSets = new Map<string, DuplicateSet>();
    const groupingPriority = (key: string): number => (key.startsWith("username+uri:") ? 2 : 1);

    for (const set of duplicateSets) {
      const signature = set.ciphers
        .map((c) => c.id)
        .sort()
        .join("|");
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
   * Get normalized keys for the given URIs according to a strategy.
   */
  private getUriKeysForStrategy(
    uris: string[],
    strategy: UriMatchStrategy,
    warningAccumulator?: WarningAccumulator,
  ): Set<string> {
    const keys = new Set<string>();
    for (const raw of uris) {
      const parsed = this.parseUri(raw);
      if (!parsed) {
        continue;
      }
      if (parsed.unparseable) {
        if (warningAccumulator) {
          warningAccumulator.unparseableUriCount++;
          warningAccumulator.unparseableUris.push(parsed.original);
        }
        continue;
      }
      switch (strategy) {
        case "Base": {
          const base = this.getBaseUri(parsed);
          if (base) {
            keys.add(base);
          }
          break;
        }
        case "Hostname": {
          const hostName = this.getHostname(parsed);
          if (hostName) {
            keys.add(hostName);
          }
          break;
        }
        case "Host": {
          const host = this.getHost(parsed);
          if (host) {
            keys.add(host);
          }
          break;
        }
        case "Exact": {
          if (parsed.approximate && warningAccumulator) {
            warningAccumulator.exactFallbackCount++;
            if (warningAccumulator.exactFallbackUris.length < 10) {
              warningAccumulator.exactFallbackUris.push(parsed.original);
            }
          }
          const exact = this.getExactUrlKey(parsed);
          if (exact) {
            keys.add(exact);
          }
          break;
        }
      }
    }
    return keys;
  }

  /**
   * Parse a URI/host-like string into components for strategy matching.
   * - Supports androidapp:// and androidapp: scheme, normalizing to androidPackage.
   * - Adds http:// scheme if missing for URL parsing.
   */
  private parseUri(raw: string): ParsedUri | null {
    if (!raw) {
      return null;
    }
    const input = raw.trim();
    if (!input) {
      return null;
    }

    // Android package
    const m1 = input.match(/^androidapp:\/\/([^/?#]+)(?:[/?#].*)?$/i);
    if (m1?.[1]) {
      const pkg = m1[1].trim().replace(/\.$/, "").toLowerCase();
      return { original: input, androidPackage: pkg };
    }
    const m2 = input.match(/^androidapp:([^\s/?#]+).*$/i);
    if (m2?.[1]) {
      const pkg = m2[1].trim().replace(/\.$/, "").toLowerCase();
      return { original: input, androidPackage: pkg };
    }

    let toParse = input;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(toParse)) {
      // Align with convention when lacking scheme
      // https://bitwarden.com/help/uri-match-detection/#uri-schemes
      toParse = "http://" + toParse;
    }
    try {
      const url = new URL(toParse);
      let hostname = url.hostname || "";
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.slice(1, -1);
      }
      hostname = hostname.replace(/\.$/, "").toLowerCase();
      const port = url.port || "";
      const scheme = (url.protocol || "").replace(/:$/, "").toLowerCase();
      const path = url.pathname || "";
      const query = url.search || "";
      const fragment = url.hash || "";
      return {
        original: input,
        scheme,
        hostname,
        port,
        path,
        query,
        fragment,
      };
    } catch {
      // Fallback manual authority extraction sufficient for Hostname/Base/Host strategies.
      // Mark the result as `approximate`; getUriKeysForStrategy counts a fallback warning
      // only when the selected strategy is "Exact". Other strategies continue normally.
      const authorityMatch = toParse.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
      if (!authorityMatch) {
        // Mark as unparseable so the caller can report and skip safely
        return { original: input, unparseable: true };
      }
      let authority = authorityMatch[1];
      const atIndex = authority.lastIndexOf("@");
      if (atIndex !== -1) {
        authority = authority.slice(atIndex + 1);
      }
      let host = authority;
      let port = "";
      if (authority.startsWith("[")) {
        const end = authority.indexOf("]");
        if (end !== -1) {
          host = authority.slice(1, end);
          const rest = authority.slice(end + 1);
          if (rest.startsWith(":")) {
            const p = rest.slice(1);
            if (/^[0-9]+$/.test(p)) {
              port = p;
            }
          }
        }
      } else {
        const c = authority.lastIndexOf(":");
        if (c !== -1) {
          const p = authority.slice(c + 1);
          if (/^[0-9]+$/.test(p)) {
            host = authority.slice(0, c);
            port = p;
          } else {
            // Non-numeric suffix after colon isn't a valid port -> treat as part of path/opaque
            // Strip it from the host for host-based strategies.
            host = authority.slice(0, c);
          }
        }
      }
      host = host.replace(/\.$/, "").toLowerCase();
      return { original: input, hostname: host, port, approximate: true };
    }
  }

  /**
   * Compute the "Base" key for a URI (registrable domain when possible).
   *
   * Order of operations:
   * 1) androidapp -> package id.
   * 2) IP/IPv6 -> return literal host (no domain logic).
   * 3) Use PSL via Utils.getDomain(scheme://host) to resolve registrable domain for public suffixes.
   * 4) Guard against over-grouping on likely private TLDs (e.g., .local, .internal, .lan, .corp, .home):
   *    when PSL returns only two labels but the original host has more labels, prefer the full host.
   * 5) If PSL returns nothing (true miss), return the full host (do NOT fall back to last-two-label).
   */
  private getBaseUri(p: ParsedUri): string {
    if (p.androidPackage) {
      return p.androidPackage;
    }
    const host = (p.hostname || "").toLowerCase();
    if (!host) {
      return "";
    }
    // IP addresses or IPv6 literals: never reduce further
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
      return host; // IPv4 or IPv6 literal
    }

    const scheme = p.scheme || "http";
    const urlLike = `${scheme}://${host}`;
    // Try PSL to get the registrable domain for public suffixes.
    const domain = Utils.getDomain(urlLike)?.toLowerCase();
    if (domain) {
      // Avoid over-grouping for likely private TLDs where getDomain effectively collapses to last-two-label.
      // Example: grafana.monitoring.svc.cluster.local would otherwise collapse to cluster.local.
      const parts = host.split(".").filter(Boolean);
      const dparts = domain.split(".").filter(Boolean);
      const tld = dparts[dparts.length - 1];
      const PRIVATE_SUFFIX_TLDS = new Set(["local", "internal", "lan", "corp", "home"]);
      if (dparts.length === 2 && parts.length > 2 && PRIVATE_SUFFIX_TLDS.has(tld)) {
        return host;
      }
      return domain;
    }
    // PSL miss (no registrable domain): prefer full host to avoid over-grouping on private/internal DNS.
    // Previous behavior used last-two-label; we intentionally avoid that here.
    return host;
  }

  private getHostname(p: ParsedUri): string {
    if (p.androidPackage) {
      return p.androidPackage;
    }
    return (p.hostname || "").toLowerCase();
  }

  private getHost(p: ParsedUri): string {
    const host = this.getHostname(p);
    if (!host) {
      return "";
    }
    const port = p.port?.trim();
    return port ? `${host}:${port}` : host;
  }

  private getExactUrlKey(p: ParsedUri): string {
    if (p.androidPackage) {
      return `androidapp:${p.androidPackage}`;
    }
    const host = p.hostname || "";
    const scheme = p.scheme || "http"; // Bitwarden convention assumes http when missing
    const port = p.port ? `:${p.port}` : "";
    const path = p.path || "";
    const query = p.query || "";
    const fragment = p.fragment || "";
    if (!host) {
      return p.original.toLowerCase();
    }
    return `${scheme}://${host}${port}${path}${query}${fragment}`.toLowerCase();
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
    warningAccumulator?: WarningAccumulator,
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
    // When users lack permission to delete an item (e.g., org-owned or restricted by collection permissions),
    // record this so the UI can notify them.
    const permissionChecks = uniqueDeleteIds.map(async (id) => {
      const cipher = cipherIndex.get(id);
      if (!cipher) {
        return { cipher: null as CipherView | null, canDelete: false };
      }
      const canDelete = await firstValueFrom(
        this.cipherAuthorizationService.canDeleteCipher$(cipher),
      );
      return { cipher, canDelete };
    });
    const permissionResults = await Promise.all(permissionChecks);
    const permitted: CipherView[] = [];
    const denied: CipherView[] = [];
    for (const r of permissionResults) {
      if (!r.cipher) {
        continue;
      }
      if (r.canDelete) {
        permitted.push(r.cipher);
      } else {
        denied.push(r.cipher);
      }
    }
    if (warningAccumulator && denied.length > 0) {
      warningAccumulator.permissionDeniedCount += denied.length;
      for (const d of denied) {
        const name = d.name?.trim();
        if (name && warningAccumulator.permissionDeniedNames.length < 10) {
          warningAccumulator.permissionDeniedNames.push(name);
        }
      }
    }
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
