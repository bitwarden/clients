// Lunr search is used for advanced querys which most users do not use. It is preformance heavy and should only be built when needed.

import { StateProvider, UserKeyDefinition, VAULT_SEARCH_MEMORY } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";
import lunr from "lunr";
import { filter, firstValueFrom, map, Observable } from "rxjs";
import { Jsonify } from "type-fest";
import { normalizeSearchQuery } from "./search.service";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";
import { CipherType } from "../enums/cipher-type";
import { FieldType } from "../enums/field-type.enum";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { perUserCache$ } from "../utils/observable-utilities";

export type SerializedLunrIndex = {
  version: string;
  fields: string[];
  fieldVectors: [string, number[]];
  invertedIndex: any[];
  pipeline: string[];
};

/**
 * The `KeyDefinition` for accessing the search index in application state.
 * The key definition is configured to clear the index when the user locks the vault.
 */
export const LUNR_SEARCH_INDEX = new UserKeyDefinition<SerializedLunrIndex>(
  VAULT_SEARCH_MEMORY,
  "searchIndex",
  {
    deserializer: (obj: Jsonify<SerializedLunrIndex>) => obj,
    clearOn: ["lock", "logout"],
  },
);

/**
 * The `KeyDefinition` for accessing the state of Lunr search indexing, indicating whether the Lunr search index is currently being built or updating.
 * The key definition is configured to clear the indexing state when the user locks the vault.
 */
export const LUNR_SEARCH_INDEXING = new UserKeyDefinition<boolean>(
  VAULT_SEARCH_MEMORY,
  "isIndexing",
  {
    deserializer: (obj: Jsonify<boolean>) => obj,
    clearOn: ["lock", "logout"],
  },
);

export class LunrSearchService {
  private static registeredPipeline = false;

  constructor(
    private stateProvider: StateProvider,
    private logService: LogService,
  ) {
    // Currently have to ensure this is only done a single time. Lunr allows you to register a function
    // multiple times but they will add a warning message to the console. The way they do that breaks when ran on a service worker.
    if (!LunrSearchService.registeredPipeline) {
      LunrSearchService.registeredPipeline = true;
      //register lunr pipeline function
      lunr.Pipeline.registerFunction(normalizeAccentsPipelineFunction, "normalizeAccents");
    }
  }

  async ciphersUpdated(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, LUNR_SEARCH_INDEX).update(() => null);
    await this.stateProvider.getUser(userId, LUNR_SEARCH_INDEXING).update(() => false);
  }

  private searchIndexState(userId: UserId) {
    return this.stateProvider.getUser(userId, LUNR_SEARCH_INDEX);
  }

  private index$ = perUserCache$((userId: UserId) => {
    return this.searchIndexState(userId).state$.pipe(
      map((searchIndex) => {
        let index: lunr.Index | null = null;
        if (searchIndex) {
          const loadTime = performance.now();
          index = lunr.Index.load(searchIndex);
          this.logService.measure(loadTime, "Vault", "SearchService", "index load");
        }
        return index;
      }),
    );
  });

  private searchIsIndexingState(userId: UserId) {
    return this.stateProvider.getUser(userId, LUNR_SEARCH_INDEXING);
  }

  private searchIsIndexing$(userId: UserId): Observable<boolean> {
    return this.searchIsIndexingState(userId).state$.pipe(map((indexing) => indexing ?? false));
  }

  async getIndexForSearch(userId: UserId): Promise<lunr.Index | null> {
    return await firstValueFrom(this.index$(userId));
  }

  private async setIndexForSearch(userId: UserId, index: SerializedLunrIndex): Promise<void> {
    await this.searchIndexState(userId).update(() => index);
  }

  private async setIsIndexing(userId: UserId, indexing: boolean): Promise<void> {
    await this.searchIsIndexingState(userId).update(() => indexing);
  }

  private async getIsIndexing(userId: UserId): Promise<boolean> {
    return await firstValueFrom(this.searchIsIndexing$(userId));
  }

  async searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    query: string,
    ciphers: C[],
  ): Promise<C[]> {
    const results: C[] = [];
    const searchStartTime = performance.now();
    await this.updateIndexForUser(userId, ciphers);
    const index = await this.getIndexForSearch(userId);

    // Convert to map that can be looked up in
    const ciphersMap = new Map<string, C>();
    ciphers.forEach((c) => ciphersMap.set(uuidAsString(c.id), c));

    // Search and push to results
    try {
      let searchResults: lunr.Index.Result[] = index.search(query.substr(1).trim());
      searchResults.forEach((r) => {
        if (ciphersMap.has(r.ref)) {
          results.push(ciphersMap.get(r.ref));
        }
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.logService.measure(searchStartTime, "Vault", "LunrSearchService", "search complete");
    return results;
  }

  private async updateIndexForUser(userId: UserId, ciphers: CipherViewLike[]): Promise<void> {
    // If another indexing operation is in progress for this user, wait for it then return.
    if (await this.getIsIndexing(userId)) {
      await firstValueFrom(this.searchIsIndexing$(userId).pipe(filter((indexing) => !indexing)));
      return;
    }

    // If there is no index in progress, build an index for the user and set it to state.
    await this.setIsIndexing(userId, true);
    const start = performance.now();
    this.logService.info("Starting Lunr index build");
    const index = await buildCipherIndex(ciphers);
    this.logService.info("Lunr index build complete");
    this.logService.measure(start, "Vault", "LunrSearchService", "index build complete", [
      ["Items Indexed", ciphers.length],
    ]);
    await this.setIndexForSearch(userId, index.toJSON() as SerializedLunrIndex);
    await this.setIsIndexing(userId, false);
  }
}

/// Helper functions and extractors

function normalizeAccentsPipelineFunction(token: lunr.Token): any {
  const searchableFields = ["name", "login.username", "subtitle", "notes"];
  const fields = (token as any).metadata["fields"];
  const checkFields = fields.every((i: any) => searchableFields.includes(i));

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
    extractor: (c: CipherViewLike) => uuidAsString(c.id).substr(0, 8),
  });
  builder.field("name", {
    boost: 10,
    extractor: (c: CipherViewLike) => c.name,
  });
  builder.field("subtitle", {
    boost: 5,
    extractor: (c: CipherViewLike) => {
      const subtitle = CipherViewLikeUtils.subtitle(c);
      if (subtitle != null && CipherViewLikeUtils.getType(c) === CipherType.Card) {
        return subtitle.replace(/\*/g, "");
      }
      return subtitle;
    },
  });
  builder.field("notes", { extractor: (c: CipherViewLike) => CipherViewLikeUtils.getNotes(c) });
  builder.field("login.username", {
    extractor: (c: CipherViewLike) => {
      const login = CipherViewLikeUtils.getLogin(c);
      return login?.username ?? null;
    },
  });
  builder.field("login.uris", {
    boost: 2,
    extractor: (c: CipherViewLike) => uriExtractor(c),
  });
  builder.field("fields", {
    extractor: (c: CipherViewLike) => fieldExtractor(c, false),
  });
  builder.field("fields_joined", {
    extractor: (c: CipherViewLike) => fieldExtractor(c, true),
  });
  builder.field("attachments", {
    extractor: (c: CipherViewLike) => attachmentExtractor(c, false),
  });
  builder.field("attachments_joined", {
    extractor: (c: CipherViewLike) => attachmentExtractor(c, true),
  });
  builder.field("organizationid", { extractor: (c: CipherViewLike) => c.organizationId });
  ciphers = ciphers || [];
  ciphers.forEach((c) => builder.add(c));
  const index = builder.build();
  return index;
}

async function fieldExtractor(c: CipherViewLike, joined: boolean) {
  const fields = CipherViewLikeUtils.getFields(c);
  if (!fields || fields.length === 0) {
    return null;
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
    return null;
  }
  return joined ? fieldStrings.join(" ") : fieldStrings;
}

async function attachmentExtractor(c: CipherViewLike, joined: boolean) {
  const attachmentNames = CipherViewLikeUtils.getAttachmentNames(c);
  if (!attachmentNames || attachmentNames.length === 0) {
    return null;
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
    return null;
  }
  return joined ? attachments.join(" ") : attachments;
}

async function uriExtractor(c: CipherViewLike) {
  if (CipherViewLikeUtils.getType(c) !== CipherType.Login) {
    return null;
  }
  const login = CipherViewLikeUtils.getLogin(c);
  if (!login?.uris?.length) {
    return null;
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

  return uris.length > 0 ? uris : null;
}
