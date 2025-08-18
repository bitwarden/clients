// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as lunr from "lunr";
import { Observable, firstValueFrom, map, startWith } from "rxjs";
import { Jsonify } from "type-fest";

import { perUserCache$ } from "@bitwarden/common/vault/utils/observable-utilities";

import { UriMatchStrategy } from "../../models/domain/domain-service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_SEARCH_MEMORY,
} from "../../platform/state";
import { SendView } from "../../tools/send/models/view/send.view";
import { IndexedEntityId, UserId } from "../../types/guid";
import { SearchService as SearchServiceAbstraction } from "../abstractions/search.service";
import { FieldType } from "../enums";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

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
 * The `KeyDefinition` for accessing the ID of the entity currently indexed by Lunr search.
 * The key definition is configured to clear the indexed entity ID when the user locks the vault.
 */
export const LUNR_SEARCH_INDEXED_ENTITY_ID = new UserKeyDefinition<IndexedEntityId>(
  VAULT_SEARCH_MEMORY,
  "searchIndexedEntityId",
  {
    deserializer: (obj: Jsonify<IndexedEntityId>) => obj,
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

export class SearchService implements SearchServiceAbstraction {
  private static registeredPipeline = false;

  private readonly immediateSearchLocales: string[] = ["zh-CN", "zh-TW", "ja", "ko", "vi"];
  private readonly defaultSearchableMinLength: number = 2;
  private searchableMinLength: number = this.defaultSearchableMinLength;

  constructor(
    private logService: LogService,
    private i18nService: I18nService,
    private stateProvider: StateProvider,
  ) {
    this.i18nService.locale$.subscribe((locale) => {
      if (this.immediateSearchLocales.indexOf(locale) !== -1) {
        this.searchableMinLength = 1;
      } else {
        this.searchableMinLength = this.defaultSearchableMinLength;
      }
    });

    // Currently have to ensure this is only done a single time. Lunr allows you to register a function
    // multiple times but they will add a warning message to the console. The way they do that breaks when ran on a service worker.
    if (!SearchService.registeredPipeline) {
      SearchService.registeredPipeline = true;
      //register lunr pipeline function
      lunr.Pipeline.registerFunction(this.normalizeAccentsPipelineFunction, "normalizeAccents");
    }
  }

  private searchIndexState(userId: UserId): SingleUserState<SerializedLunrIndex> {
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
      startWith(null),
    );
  });

  private searchIndexEntityIdState(userId: UserId): SingleUserState<IndexedEntityId | null> {
    return this.stateProvider.getUser(userId, LUNR_SEARCH_INDEXED_ENTITY_ID);
  }

  indexedEntityId$(userId: UserId): Observable<IndexedEntityId | null> {
    return this.searchIndexEntityIdState(userId).state$.pipe(map((id) => id));
  }

  private searchIsIndexingState(userId: UserId): SingleUserState<boolean> {
    return this.stateProvider.getUser(userId, LUNR_SEARCH_INDEXING);
  }

  private searchIsIndexing$(userId: UserId): Observable<boolean> {
    return this.searchIsIndexingState(userId).state$.pipe(map((indexing) => indexing ?? false));
  }

  async clearIndex(userId: UserId): Promise<void> {
    await this.searchIndexEntityIdState(userId).update(() => null);
    await this.searchIndexState(userId).update(() => null);
    await this.searchIsIndexingState(userId).update(() => null);
  }

  async isSearchable(userId: UserId, query: string): Promise<boolean> {
    const time = performance.now();
    query = SearchService.normalizeSearchQuery(query);
    const index = await this.getIndexForSearch(userId);
    const notSearchable =
      query == null ||
      (index == null && query.length < this.searchableMinLength) ||
      (index != null && query.length < this.searchableMinLength && query.indexOf(">") !== 0);

    this.logService.measure(time, "Vault", "SearchService", "isSearchable");
    return !notSearchable;
  }

  async indexCiphers(
    userId: UserId,
    ciphers: CipherView[],
    indexedEntityId?: string,
  ): Promise<void> {
    if (await this.getIsIndexing(userId)) {
      return;
    }

    const indexingStartTime = performance.now();
    await this.setIsIndexing(userId, true);
    await this.setIndexedEntityIdForSearch(userId, indexedEntityId as IndexedEntityId);
    const builder = new lunr.Builder();
    builder.pipeline.add(this.normalizeAccentsPipelineFunction);
    builder.ref("id");
    builder.field("shortid", { boost: 100, extractor: (c: CipherView) => c.id.substr(0, 8) });
    builder.field("name", {
      boost: 10,
    });
    builder.field("subtitle", {
      boost: 5,
      extractor: (c: CipherView) => {
        if (c.subTitle != null && c.type === CipherType.Card) {
          return c.subTitle.replace(/\*/g, "");
        }
        return c.subTitle;
      },
    });
    builder.field("notes");
    builder.field("login.username", {
      extractor: (c: CipherView) =>
        c.type === CipherType.Login && c.login != null ? c.login.username : null,
    });
    builder.field("login.uris", { boost: 2, extractor: (c: CipherView) => this.uriExtractor(c) });
    builder.field("fields", { extractor: (c: CipherView) => this.fieldExtractor(c, false) });
    builder.field("fields_joined", { extractor: (c: CipherView) => this.fieldExtractor(c, true) });
    builder.field("attachments", {
      extractor: (c: CipherView) => this.attachmentExtractor(c, false),
    });
    builder.field("attachments_joined", {
      extractor: (c: CipherView) => this.attachmentExtractor(c, true),
    });
    builder.field("organizationid", { extractor: (c: CipherView) => c.organizationId });
    ciphers = ciphers || [];
    ciphers.forEach((c) => builder.add(c));
    const index = builder.build();

    await this.setIndexForSearch(userId, index.toJSON() as SerializedLunrIndex);

    await this.setIsIndexing(userId, false);

    this.logService.measure(indexingStartTime, "Vault", "SearchService", "index complete", [
      ["Items", ciphers.length],
    ]);
  }

  async searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    query: string,
    filter: ((cipher: C) => boolean) | ((cipher: C) => boolean)[] = null,
    ciphers: C[],
  ): Promise<C[]> {
    const results: C[] = [];
    if (query != null) {
      query = SearchService.normalizeSearchQuery(query.trim().toLowerCase());
    }
    if (query === "") {
      query = null;
    }

    if (ciphers == null) {
      ciphers = [];
    }

    if (filter != null && Array.isArray(filter) && filter.length > 0) {
      ciphers = ciphers.filter((c) => filter.every((f) => f == null || f(c)));
    } else if (filter != null) {
      ciphers = ciphers.filter(filter as (cipher: C) => boolean);
    }

    if (!(await this.isSearchable(userId, query))) {
      return ciphers;
    }

    if (await this.getIsIndexing(userId)) {
      await new Promise((r) => setTimeout(r, 250));
      if (await this.getIsIndexing(userId)) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const index = await this.getIndexForSearch(userId);
    if (index == null) {
      // Fall back to basic search if index is not available
      return this.searchCiphersBasic(ciphers, query);
    }

    const ciphersMap = new Map<string, C>();
    ciphers.forEach((c) => ciphersMap.set(c.id, c));

    let searchResults: lunr.Index.Result[] = null;
    const isQueryString = query != null && query.length > 1 && query.indexOf(">") === 0;
    if (isQueryString) {
      try {
        searchResults = index.search(query.substr(1).trim());
      } catch (e) {
        this.logService.error(e);
      }
    } else {
      const soWild = lunr.Query.wildcard.LEADING | lunr.Query.wildcard.TRAILING;
      searchResults = index.query((q) => {
        lunr.tokenizer(query).forEach((token) => {
          const t = token.toString();
          q.term(t, { fields: ["name"], wildcard: soWild });
          q.term(t, { fields: ["subtitle"], wildcard: soWild });
          q.term(t, { fields: ["login.uris"], wildcard: soWild });
          q.term(t, {});
        });
      });
    }

    if (searchResults != null) {
      searchResults.forEach((r) => {
        if (ciphersMap.has(r.ref)) {
          results.push(ciphersMap.get(r.ref));
        }
      });
    }
    return results;
  }

  searchCiphersBasic<C extends CipherViewLike>(ciphers: C[], query: string, deleted = false) {
    query = SearchService.normalizeSearchQuery(query.trim().toLowerCase());
    return ciphers.filter((c) => {
      if (deleted !== CipherViewLikeUtils.isDeleted(c)) {
        return false;
      }
      if (c.name != null && c.name.toLowerCase().indexOf(query) > -1) {
        return true;
      }
      if (query.length >= 8 && c.id.startsWith(query)) {
        return true;
      }
      const subtitle = CipherViewLikeUtils.subtitle(c);
      if (subtitle != null && subtitle.toLowerCase().indexOf(query) > -1) {
        return true;
      }

      const login = CipherViewLikeUtils.getLogin(c);

      if (
        login &&
        login.uris.length &&
        login.uris.some((loginUri) => loginUri?.uri?.toLowerCase().indexOf(query) > -1)
      ) {
        return true;
      }
      return false;
    });
  }

  searchSends(sends: SendView[], query: string) {
    query = SearchService.normalizeSearchQuery(query.trim().toLocaleLowerCase());
    if (query === null) {
      return sends;
    }
    const sendsMatched: SendView[] = [];
    const lowPriorityMatched: SendView[] = [];
    sends.forEach((s) => {
      if (s.name != null && s.name.toLowerCase().indexOf(query) > -1) {
        sendsMatched.push(s);
      } else if (
        query.length >= 8 &&
        (s.id.startsWith(query) ||
          s.accessId.toLocaleLowerCase().startsWith(query) ||
          (s.file?.id != null && s.file.id.startsWith(query)))
      ) {
        lowPriorityMatched.push(s);
      } else if (s.notes != null && s.notes.toLowerCase().indexOf(query) > -1) {
        lowPriorityMatched.push(s);
      } else if (s.text?.text != null && s.text.text.toLowerCase().indexOf(query) > -1) {
        lowPriorityMatched.push(s);
      } else if (s.file?.fileName != null && s.file.fileName.toLowerCase().indexOf(query) > -1) {
        lowPriorityMatched.push(s);
      }
    });
    return sendsMatched.concat(lowPriorityMatched);
  }

  async getIndexForSearch(userId: UserId): Promise<lunr.Index | null> {
    return await firstValueFrom(this.index$(userId));
  }

  private async setIndexForSearch(userId: UserId, index: SerializedLunrIndex): Promise<void> {
    await this.searchIndexState(userId).update(() => index);
  }

  private async setIndexedEntityIdForSearch(
    userId: UserId,
    indexedEntityId: IndexedEntityId,
  ): Promise<void> {
    await this.searchIndexEntityIdState(userId).update(() => indexedEntityId);
  }

  private async setIsIndexing(userId: UserId, indexing: boolean): Promise<void> {
    await this.searchIsIndexingState(userId).update(() => indexing);
  }

  private async getIsIndexing(userId: UserId): Promise<boolean> {
    return await firstValueFrom(this.searchIsIndexing$(userId));
  }

  private fieldExtractor(c: CipherView, joined: boolean) {
    if (!c.hasFields) {
      return null;
    }
    let fields: string[] = [];
    c.fields.forEach((f) => {
      if (f.name != null) {
        fields.push(f.name);
      }
      if (f.type === FieldType.Text && f.value != null) {
        fields.push(f.value);
      }
    });
    fields = fields.filter((f) => f.trim() !== "");
    if (fields.length === 0) {
      return null;
    }
    return joined ? fields.join(" ") : fields;
  }

  private attachmentExtractor(c: CipherView, joined: boolean) {
    if (!c.hasAttachments) {
      return null;
    }
    let attachments: string[] = [];
    c.attachments.forEach((a) => {
      if (a != null && a.fileName != null) {
        if (joined && a.fileName.indexOf(".") > -1) {
          attachments.push(a.fileName.substr(0, a.fileName.lastIndexOf(".")));
        } else {
          attachments.push(a.fileName);
        }
      }
    });
    attachments = attachments.filter((f) => f.trim() !== "");
    if (attachments.length === 0) {
      return null;
    }
    return joined ? attachments.join(" ") : attachments;
  }

  private uriExtractor(c: CipherView) {
    if (c.type !== CipherType.Login || c.login == null || !c.login.hasUris) {
      return null;
    }
    const uris: string[] = [];
    c.login.uris.forEach((u) => {
      if (u.uri == null || u.uri === "") {
        return;
      }
      if (u.hostname != null) {
        uris.push(u.hostname);
        return;
      }
      let uri = u.uri;
      if (u.match !== UriMatchStrategy.RegularExpression) {
        const protocolIndex = uri.indexOf("://");
        if (protocolIndex > -1) {
          uri = uri.substr(protocolIndex + 3);
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

  private normalizeAccentsPipelineFunction(token: lunr.Token): any {
    const searchableFields = ["name", "login.username", "subtitle", "notes"];
    const fields = (token as any).metadata["fields"];
    const checkFields = fields.every((i: any) => searchableFields.includes(i));

    if (checkFields) {
      return SearchService.normalizeSearchQuery(token.toString());
    }

    return token;
  }

  // Remove accents/diacritics characters from text. This regex is equivalent to the Diacritic unicode property escape, i.e. it will match all diacritic characters.
  static normalizeSearchQuery(query: string): string {
    return query?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}
