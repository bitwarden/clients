// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as lunr from "lunr";
import { Observable, firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { SearchService as SearchServiceAbstraction } from "../abstractions/search.service";
import { UriMatchStrategy } from "../models/domain/domain-service";
import { I18nService } from "../platform/abstractions/i18n.service";
import { LogService } from "../platform/abstractions/log.service";
import {
  ActiveUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_SEARCH_MEMORY,
} from "../platform/state";
import { SendView } from "../tools/send/models/view/send.view";
import { IndexedEntityId } from "../types/guid";
import { FieldType } from "../vault/enums";
import { CipherType } from "../vault/enums/cipher-type";
import { CipherView } from "../vault/models/view/cipher.view";

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

  private searchIndexState: ActiveUserState<SerializedLunrIndex> =
    this.stateProvider.getActive(LUNR_SEARCH_INDEX);
  private readonly index$: Observable<lunr.Index | null> = this.searchIndexState.state$.pipe(
    map((searchIndex) => (searchIndex ? lunr.Index.load(searchIndex) : null)),
  );

  private searchIndexEntityIdState: ActiveUserState<IndexedEntityId> = this.stateProvider.getActive(
    LUNR_SEARCH_INDEXED_ENTITY_ID,
  );
  readonly indexedEntityId$: Observable<IndexedEntityId | null> =
    this.searchIndexEntityIdState.state$.pipe(map((id) => id));

  private searchIsIndexingState: ActiveUserState<boolean> =
    this.stateProvider.getActive(LUNR_SEARCH_INDEXING);
  private readonly searchIsIndexing$: Observable<boolean> = this.searchIsIndexingState.state$.pipe(
    map((indexing) => indexing ?? false),
  );

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

  async clearIndex(): Promise<void> {
    await this.searchIndexEntityIdState.update(() => null);
    await this.searchIndexState.update(() => null);
    await this.searchIsIndexingState.update(() => null);
  }

  async isSearchable(query: string): Promise<boolean> {
    query = SearchService.normalizeSearchQuery(query);
    const index = await this.getIndexForSearch();
    const notSearchable =
      query == null ||
      (index == null && query.length < this.searchableMinLength) ||
      (index != null && query.length < this.searchableMinLength && query.indexOf(">") !== 0);
    return !notSearchable;
  }

  async indexCiphers(ciphers: CipherView[], indexedEntityId?: string): Promise<void> {
    if (await this.getIsIndexing()) {
      return;
    }

    await this.setIsIndexing(true);
    await this.setIndexedEntityIdForSearch(indexedEntityId as IndexedEntityId);
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

    await this.setIndexForSearch(index.toJSON() as SerializedLunrIndex);

    await this.setIsIndexing(false);

    this.logService.info("Finished search indexing");
  }

  async searchCiphers(
    query: string,
    filter: ((cipher: CipherView) => boolean) | ((cipher: CipherView) => boolean)[] = null,
    ciphers: CipherView[],
  ): Promise<CipherView[]> {
    const results: CipherView[] = [];
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
      ciphers = ciphers.filter(filter as (cipher: CipherView) => boolean);
    }

    if (!(await this.isSearchable(query))) {
      return ciphers;
    }

    if (await this.getIsIndexing()) {
      await new Promise((r) => setTimeout(r, 250));
      if (await this.getIsIndexing()) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const index = await this.getIndexForSearch();
    if (index == null) {
      // Fall back to basic search if index is not available
      return this.searchCiphersBasic(ciphers, query);
    }

    const ciphersMap = new Map<string, CipherView>();
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

  searchCiphersBasic(ciphers: CipherView[], query: string, deleted = false) {
    query = SearchService.normalizeSearchQuery(query.trim().toLowerCase());
    return ciphers.filter((c) => {
      if (deleted !== c.isDeleted) {
        return false;
      }
      if (c.name != null && c.name.toLowerCase().indexOf(query) > -1) {
        return true;
      }
      if (query.length >= 8 && c.id.startsWith(query)) {
        return true;
      }
      if (c.subTitle != null && c.subTitle.toLowerCase().indexOf(query) > -1) {
        return true;
      }
      if (
        c.login &&
        c.login.hasUris &&
        c.login.uris.some((loginUri) => loginUri?.uri?.toLowerCase().indexOf(query) > -1)
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

  async getIndexForSearch(): Promise<lunr.Index | null> {
    return await firstValueFrom(this.index$);
  }

  private async setIndexForSearch(index: SerializedLunrIndex): Promise<void> {
    await this.searchIndexState.update(() => index);
  }

  private async setIndexedEntityIdForSearch(indexedEntityId: IndexedEntityId): Promise<void> {
    await this.searchIndexEntityIdState.update(() => indexedEntityId);
  }

  private async setIsIndexing(indexing: boolean): Promise<void> {
    await this.searchIsIndexingState.update(() => indexing);
  }

  private async getIsIndexing(): Promise<boolean> {
    return await firstValueFrom(this.searchIsIndexing$);
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
