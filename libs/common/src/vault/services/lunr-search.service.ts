// Lunr search is used for advanced queries which most users do not use. It is performance heavy and should only be built when needed.

import * as lunr from "lunr";
import { Opaque } from "type-fest";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { UserId } from "@bitwarden/user-core";

import { UriMatchStrategy } from "../../models/domain/domain-service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { CipherType } from "../enums/cipher-type";
import { FieldType } from "../enums/field-type.enum";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

import { normalizeSearchQuery } from "./search.service";

export type IndexId = Opaque<string, "IndexId">;

type IndexState = {
  lunrIndex: lunr.Index;
  numberOfCiphers: number;
  revisionDate: Date;
};

export class LunrSearchService {
  private static registeredPipeline = false;
  private static readonly indexLockPollIntervalMs = 20;
  private static readonly indexLockForceAcquireTimeoutMs = 10_000;

  private isIndexing = false;
  // Index caching lives in memory of the service, not as a state provider.
  // Moving to a state provider would both make some cases slower (since restoring from a serialized state provider takes some time),
  // would require more complex caching, and also eats significantly more memory.
  // There is no functional difference except on browser extension, where closing the extension window will now
  // clear the index. The first time an extension window is opened, and a lunr query is run, the index has to be re-built instead of being re-loaded.
  private lunrIndices: Map<IndexId, IndexState> = new Map();

  constructor(private logService: LogService) {
    // Currently have to ensure this is only done a single time. Lunr allows you to register a function
    // multiple times but they will add a warning message to the console. The way they do that breaks when ran on a service worker.
    if (!LunrSearchService.registeredPipeline) {
      LunrSearchService.registeredPipeline = true;
      //register lunr pipeline function
      lunr.Pipeline.registerFunction(normalizeAccentsPipelineFunction, "normalizeAccents");
    }
  }

  async searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    organizationId: OrganizationId | null,
    query: string,
    ciphers: C[],
  ): Promise<C[]> {
    const results: C[] = [];
    const searchStartTime = performance.now();
    const index = await this.getOrCreateIndex(makeIndexId(userId, organizationId), ciphers);

    // Convert to map that can be looked up in
    const ciphersMap = new Map<string, C>();
    ciphers.forEach((c) => ciphersMap.set(uuidAsString(c.id), c));

    // Search and push to results
    try {
      const searchResults = index.search(query.substring(1).trim());
      searchResults.forEach((r) => {
        const cipher = ciphersMap.get(r.ref);
        if (cipher != null) {
          results.push(cipher);
        }
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.logService.measure(searchStartTime, "Vault", "LunrSearchService", "search complete");
    return results;
  }

  private async getOrCreateIndex(indexId: IndexId, ciphers: CipherViewLike[]): Promise<lunr.Index> {
    if (!this.isIndexUpToDate(indexId, ciphers)) {
      const start = performance.now();
      this.logService.info("Starting Lunr index build");

      // Only build one index concurrently
      await this.acquireIndexLock();
      let index: lunr.Index;
      try {
        index = await buildCipherIndex(ciphers);
        this.lunrIndices.set(indexId, {
          lunrIndex: index,
          numberOfCiphers: ciphers.length,
          revisionDate: new Date(),
        });
      } finally {
        await this.releaseIndexLock();
      }

      this.logService.info("Lunr index build complete");
      this.logService.measure(start, "Vault", "LunrSearchService", "index build complete", [
        ["Items Indexed", ciphers.length],
      ]);

      return index;
    } else {
      return this.lunrIndices.get(indexId)!.lunrIndex;
    }
  }

  /**
   * The ciphers belonging to an index can be modified in the following ways:
   * - Cipher deletion: Will decrease cipher count
   * - Cipher addition: Will increase cipher count *and* update revision date
   * - Cipher modification: Will update revision date
   * any combination of these operations is captured by the combination of cipher count
   * and latest revision date. This means that given a list of ciphers, we can simply determine
   * whether the index is up-to-date or not, without having to externally invalidate it.
   */
  private isIndexUpToDate(indexId: IndexId, ciphers: CipherViewLike[]): boolean {
    const indexState = this.lunrIndices.get(indexId);
    if (!indexState) {
      return false;
    }
    if (indexState.numberOfCiphers !== ciphers.length) {
      return false;
    }
    const latestCipherDate = ciphers.reduce((latest, c) => {
      const modified = c.revisionDate ? new Date(c.revisionDate) : new Date(0);
      if (modified > latest) {
        return modified;
      }
      return latest;
    }, new Date(0));
    return indexState.revisionDate >= latestCipherDate;
  }

  private async acquireIndexLock(): Promise<boolean> {
    const lockWaitStart = performance.now();
    while (this.isIndexing) {
      if (performance.now() - lockWaitStart >= LunrSearchService.indexLockForceAcquireTimeoutMs) {
        // In case somehow the index build threw previously and did not release the lock.
        this.logService.info(
          "Lunr index lock acquisition timed out after 10 seconds, forcing lock acquisition",
        );
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, LunrSearchService.indexLockPollIntervalMs),
      );
    }

    this.isIndexing = true;
    return true;
  }

  private async releaseIndexLock(): Promise<void> {
    this.isIndexing = false;
  }
}

function makeIndexId(userId: UserId, organizationId: OrganizationId | null): IndexId {
  return `${userId}${organizationId ? `-${organizationId}` : ""}` as IndexId;
}

/// Helper functions and extractors

function normalizeAccentsPipelineFunction(token: lunr.Token): any {
  const searchableFields = ["name", "login.username", "subtitle", "notes"];
  const metadata = (token as unknown as { metadata?: { fields?: unknown[] } }).metadata;
  const fields = metadata?.fields;
  const checkFields =
    Array.isArray(fields) && fields.every((i) => searchableFields.includes(String(i)));

  if (checkFields) {
    return normalizeSearchQuery(token.toString());
  }

  return token;
}

/**
 * Statelessly build a lunr index for the given cipher views.
 */
async function buildCipherIndex(ciphers: CipherViewLike[]): Promise<lunr.Index> {
  const builder = new lunr.Builder();
  builder.pipeline.add(normalizeAccentsPipelineFunction);
  builder.ref("id");
  builder.field("shortid", {
    boost: 100,
    extractor: (doc: object) => uuidAsString((doc as CipherViewLike).id).substring(0, 8),
  });
  builder.field("name", {
    boost: 10,
    extractor: (doc: object) => (doc as CipherViewLike).name ?? "",
  });
  builder.field("subtitle", {
    boost: 5,
    extractor: (doc: object) => {
      const c = doc as CipherViewLike;
      const subtitle = CipherViewLikeUtils.subtitle(c);
      if (subtitle != null && CipherViewLikeUtils.getType(c) === CipherType.Card) {
        return subtitle.replace(/\*/g, "");
      }
      return subtitle ?? "";
    },
  });
  builder.field("notes", {
    extractor: (doc: object) => CipherViewLikeUtils.getNotes(doc as CipherViewLike) ?? "",
  });
  builder.field("login.username", {
    extractor: (doc: object) => {
      const c = doc as CipherViewLike;
      const login = CipherViewLikeUtils.getLogin(c);
      return login?.username ?? "";
    },
  });
  builder.field("login.uris", {
    boost: 2,
    extractor: (doc: object) => uriExtractor(doc as CipherViewLike),
  });
  builder.field("fields", {
    extractor: (doc: object) => fieldExtractor(doc as CipherViewLike, false),
  });
  builder.field("fields_joined", {
    extractor: (doc: object) => fieldExtractor(doc as CipherViewLike, true),
  });
  builder.field("attachments", {
    extractor: (doc: object) => attachmentExtractor(doc as CipherViewLike, false),
  });
  builder.field("attachments_joined", {
    extractor: (doc: object) => attachmentExtractor(doc as CipherViewLike, true),
  });
  builder.field("organizationid", {
    extractor: (doc: object) => String((doc as CipherViewLike).organizationId ?? ""),
  });
  ciphers = ciphers || [];
  ciphers.forEach((c) => builder.add(c));
  const index = builder.build();
  return index;
}

function fieldExtractor(c: CipherViewLike, joined: boolean): string[] | string {
  const fields = CipherViewLikeUtils.getFields(c);
  if (!fields || fields.length === 0) {
    return joined ? "" : [];
  }
  let fieldStrings: string[] = [];
  fields.forEach((f) => {
    if (f.name != null) {
      fieldStrings.push(f.name);
    }
    // For CipherListView, value is only populated for Text fields
    // For CipherView, we check the type explicitly
    if (f.value != null) {
      const fieldType = (f as { type?: FieldType }).type;
      if (fieldType === undefined || fieldType === FieldType.Text) {
        fieldStrings.push(f.value);
      }
    }
  });
  fieldStrings = fieldStrings.filter((f) => f.trim() !== "");
  if (fieldStrings.length === 0) {
    return joined ? "" : [];
  }
  return joined ? fieldStrings.join(" ") : fieldStrings;
}

function attachmentExtractor(c: CipherViewLike, joined: boolean): string[] | string {
  const attachmentNames = CipherViewLikeUtils.getAttachmentNames(c);
  if (!attachmentNames || attachmentNames.length === 0) {
    return joined ? "" : [];
  }
  let attachments: string[] = [];
  attachmentNames.forEach((fileName) => {
    if (fileName != null) {
      if (joined && fileName.indexOf(".") > -1) {
        attachments.push(fileName.substring(0, fileName.lastIndexOf(".")));
      } else {
        attachments.push(fileName);
      }
    }
  });
  attachments = attachments.filter((f) => f.trim() !== "");
  if (attachments.length === 0) {
    return joined ? "" : [];
  }
  return joined ? attachments.join(" ") : attachments;
}

function uriExtractor(c: CipherViewLike): string[] {
  if (CipherViewLikeUtils.getType(c) !== CipherType.Login) {
    return [];
  }
  const login = CipherViewLikeUtils.getLogin(c);
  if (!login?.uris?.length) {
    return [];
  }
  const uris: string[] = [];
  login.uris.forEach((u) => {
    if (u.uri == null || u.uri === "") {
      return;
    }

    // Extract port from URI
    const portMatch = u.uri.match(/:(\d+)(?:[/?#]|$)/);
    const port = portMatch?.[1];

    const hostname = CipherViewLikeUtils.getUriHostname(u);
    if (hostname !== undefined) {
      uris.push(hostname);
      if (port) {
        uris.push(`${hostname}:${port}`);
        uris.push(port);
      }
    }

    // Add processed URI (strip protocol and query params for non-regex matches)
    let uri = u.uri;
    if (u.match !== UriMatchStrategy.RegularExpression) {
      const protocolIndex = uri.indexOf("://");
      if (protocolIndex > -1) {
        uri = uri.substring(protocolIndex + 3);
      }
      const queryIndex = uri.search(/\?|&|#/);
      if (queryIndex > -1) {
        uri = uri.substring(0, queryIndex);
      }
    }
    uris.push(uri);
  });

  return uris;
}
