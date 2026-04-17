// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as lunr from "lunr";
import { BehaviorSubject, Observable, firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { perUserCache$ } from "@bitwarden/common/vault/utils/observable-utilities";

import { UriMatchStrategy } from "../../models/domain/domain-service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
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
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

// LunrDocumentData is defined in search.worker.ts. We import only the type so the
// worker file itself is never included in the main bundle (type-only imports are
// erased at compile time; the worker is loaded lazily via new Worker(new URL(...))).
import type { LunrDocumentData } from "./search.worker";

// Time to wait before performing a search after the user stops typing.
export const SearchTextDebounceInterval = 200; // milliseconds

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

  private _isCipherSearching$ = new BehaviorSubject<boolean>(false);
  isCipherSearching$: Observable<boolean> = this._isCipherSearching$.asObservable();

  private _isSendSearching$ = new BehaviorSubject<boolean>(false);
  isSendSearching$: Observable<boolean> = this._isSendSearching$.asObservable();

  /**
   * One long-lived Web Worker per active user. The Worker owns the Lunr index for the
   * duration of the session so the main thread never deserialises it via
   * `lunr.Index.load()` — that call alone takes 2–3 s for large vaults.
   */
  private readonly searchWorkers = new Map<string, Worker>();

  /**
   * Set of userIds whose Worker has a fully built index ready to serve searches.
   * Also used to short-circuit `index$` so it never calls `lunr.Index.load()` when
   * the Worker is available.
   */
  private readonly workerIndexReady = new Set<string>();

  /**
   * In-flight search promises keyed by a unique requestId. The Worker's `searchResults`
   * message resolves the matching promise.
   */
  private readonly pendingSearches = new Map<
    string,
    (results: Array<{ ref: string; score: number }>) => void
  >();

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
        // When the Worker has the index in memory, all searches go through the Worker.
        // Skip deserialization here so the state-update reactive chain never causes a
        // blocking lunr.Index.load() call on the main thread.
        if (this.workerIndexReady.has(userId as string)) {
          return null;
        }
        if (!searchIndex) {
          return null;
        }
        const loadTime = performance.now();
        const index = lunr.Index.load(searchIndex);
        this.logService.measure(loadTime, "Vault", "SearchService", "index load");
        return index;
      }),
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
    this.terminateWorker(userId as string);
    await this.searchIndexEntityIdState(userId).update(() => null);
    await this.searchIndexState(userId).update(() => null);
    await this.searchIsIndexingState(userId).update(() => null);
  }

  async isSearchable(userId: UserId, query: string | null): Promise<boolean> {
    query = SearchService.normalizeSearchQuery(query);

    // Nothing to search if the query is null
    if (query == null || query === "") {
      return false;
    }

    const isLunrQuery = query.indexOf(">") === 0;
    if (isLunrQuery) {
      // Worker has the index in memory — no need to load from state.
      if (this.workerIndexReady.has(userId as string)) {
        return true;
      }
      return (await this.getIndexForSearch(userId)) != null;
    }

    // Regular queries only require a minimum length
    return query.length >= this.searchableMinLength;
  }

  async indexCiphers(
    userId: UserId,
    ciphers: CipherViewLike[],
    indexedEntityId?: string,
  ): Promise<void> {
    if (await this.getIsIndexing(userId)) {
      return;
    }

    const indexingStartTime = performance.now();
    await this.setIsIndexing(userId, true);
    await this.setIndexedEntityIdForSearch(userId, indexedEntityId as IndexedEntityId);
    ciphers = ciphers || [];

    const workerUsed = await this.buildIndexInWorker(userId, ciphers);

    if (!workerUsed) {
      // Worker unavailable — build on the main thread with chunked yielding.
      // Note: builder.build() itself is still a single synchronous call and will
      // block briefly on very large vaults. The Worker path above is the real fix.
      const builder = this.createLunrBuilder();
      const serializedIndex = await this.buildIndexChunked(builder, ciphers);
      // workerIndexReady is NOT set — searches will use the local index$ path.
      await this.setIndexForSearch(userId, serializedIndex);
    }

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
    this._isCipherSearching$.next(true);
    const results: C[] = [];
    const searchStartTime = performance.now();
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
      this._isCipherSearching$.next(false);
      return ciphers;
    }

    if (await this.getIsIndexing(userId)) {
      await new Promise((r) => setTimeout(r, 250));
      if (await this.getIsIndexing(userId)) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const ciphersMap = new Map<string, C>();
    ciphers.forEach((c) => ciphersMap.set(uuidAsString(c.id), c));

    const isQueryString = query != null && query.length > 1 && query.indexOf(">") === 0;
    // Tokenise on the main thread — same logic used when building the query on the Worker.
    const terms = isQueryString ? [] : lunr.tokenizer(query).map((t) => t.toString());

    // Prefer the long-lived Worker: the index stays in worker memory so the main thread
    // never needs to deserialise it.
    if (this.workerIndexReady.has(userId as string)) {
      const workerRefs = await this.searchInWorker(userId as string, query, isQueryString, terms);
      if (workerRefs !== null) {
        workerRefs.forEach((r) => {
          const cipher = ciphersMap.get(r.ref);
          if (cipher) {
            results.push(cipher);
          }
        });
        this.logService.measure(searchStartTime, "Vault", "SearchService", "search complete");
        this._isCipherSearching$.next(false);
        return results;
      }
    }

    // Fall back to the main-thread index (no Worker available).
    const index = await this.getIndexForSearch(userId);
    if (index == null) {
      const basicResults = this.searchCiphersBasic(ciphers, query);
      this.logService.measure(searchStartTime, "Vault", "SearchService", "basic search complete");
      this._isCipherSearching$.next(false);
      return basicResults;
    }

    let searchResults: lunr.Index.Result[] = null;
    if (isQueryString) {
      try {
        searchResults = index.search(query.substr(1).trim());
      } catch (e) {
        this.logService.error(e);
      }
    } else {
      const soWild = lunr.Query.wildcard.LEADING | lunr.Query.wildcard.TRAILING;
      searchResults = index.query((q) => {
        terms.forEach((t) => {
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
    this.logService.measure(searchStartTime, "Vault", "SearchService", "search complete");
    this._isCipherSearching$.next(false);
    return results;
  }

  searchCiphersBasic<C extends CipherViewLike>(
    ciphers: C[],
    query: string,
    deleted = false,
    archived = false,
  ) {
    query = SearchService.normalizeSearchQuery(query.trim().toLowerCase());
    return ciphers.filter((c) => {
      if (deleted !== CipherViewLikeUtils.isDeleted(c)) {
        return false;
      }
      if (archived !== CipherViewLikeUtils.isArchived(c)) {
        return false;
      }
      if (c.name != null && c.name.toLowerCase().indexOf(query) > -1) {
        return true;
      }
      if (query.length >= 8 && uuidAsString(c.id).startsWith(query)) {
        return true;
      }
      const subtitle = CipherViewLikeUtils.subtitle(c);
      if (subtitle != null && subtitle.toLowerCase().indexOf(query) > -1) {
        return true;
      }

      const login = CipherViewLikeUtils.getLogin(c);

      if (
        login &&
        login.uris?.length &&
        login.uris?.some(
          (loginUri) => loginUri?.uri && loginUri.uri.toLowerCase().indexOf(query) > -1,
        )
      ) {
        return true;
      }
      return false;
    });
  }

  searchSends(sends: SendView[], query: string) {
    this._isSendSearching$.next(true);
    query = SearchService.normalizeSearchQuery(query.trim().toLocaleLowerCase());
    if (query === null) {
      this._isSendSearching$.next(false);
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
    this._isSendSearching$.next(false);
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

  /**
   * Attempts to build the Lunr index in a Web Worker for true off-thread parallelism.
   * Falls back to a chunked main-thread approach when Workers are unavailable.
   *
   * The Worker receives plain, serialisable {@link LunrDocumentData} objects that were
   * pre-computed on the main thread using the same extractors as the inline builder.
   * This means the costly Lunr tokenisation and inverted-index construction happen
   * entirely off the main thread — the UI remains interactive throughout.
   */
  /**
   * Returns a fully configured Lunr Builder with all field definitions. Used only by the
   * main-thread fallback path; the Worker configures its own builder independently.
   */
  private createLunrBuilder(): lunr.Builder {
    const builder = new lunr.Builder();
    builder.pipeline.add(this.normalizeAccentsPipelineFunction);
    builder.ref("id");
    builder.field("shortid", {
      boost: 100,
      extractor: (c: CipherViewLike) => uuidAsString(c.id).substr(0, 8),
    });
    builder.field("name", { boost: 10 });
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
      extractor: (c: CipherViewLike) => CipherViewLikeUtils.getLogin(c)?.username ?? null,
    });
    builder.field("login.uris", {
      boost: 2,
      extractor: (c: CipherViewLike) => this.uriExtractor(c),
    });
    builder.field("fields", {
      extractor: (c: CipherViewLike) => this.fieldExtractor(c, false),
    });
    builder.field("fields_joined", {
      extractor: (c: CipherViewLike) => this.fieldExtractor(c, true),
    });
    builder.field("attachments", {
      extractor: (c: CipherViewLike) => this.attachmentExtractor(c, false),
    });
    builder.field("attachments_joined", {
      extractor: (c: CipherViewLike) => this.attachmentExtractor(c, true),
    });
    builder.field("organizationid", { extractor: (c: CipherViewLike) => c.organizationId });
    return builder;
  }

  /**
   * Gets (or creates) the long-lived Worker for a given user. Returns null when Workers
   * are unsupported (Node/Jest/CSP-restricted environments).
   */
  private getOrCreateWorker(userId: string): Worker | null {
    if (this.searchWorkers.has(userId)) {
      return this.searchWorkers.get(userId);
    }
    try {
      const worker = new Worker(new URL("./search.worker", import.meta.url), { type: "module" });

      worker.onmessage = (
        event: MessageEvent<
          | { type: "buildComplete"; serializedIndex: object }
          | {
              type: "searchResults";
              requestId: string;
              results: Array<{ ref: string; score: number }>;
            }
          | { type: "error"; error: string }
        >,
      ) => {
        const msg = event.data;
        if (msg.type === "searchResults") {
          const resolve = this.pendingSearches.get(msg.requestId);
          if (resolve) {
            this.pendingSearches.delete(msg.requestId);
            resolve(msg.results);
          }
        }
        // buildComplete and error are handled by the per-build Promise below.
      };

      this.searchWorkers.set(userId, worker);
      return worker;
    } catch {
      return null;
    }
  }

  /** Terminates the Worker for a user and clears all related state. */
  private terminateWorker(userId: string): void {
    const worker = this.searchWorkers.get(userId);
    if (worker) {
      worker.terminate();
      this.searchWorkers.delete(userId);
    }
    this.workerIndexReady.delete(userId);
    // Reject any in-flight searches so their Promises don't hang.
    this.pendingSearches.forEach((resolve, id) => {
      if (id.startsWith(userId + ":")) {
        this.pendingSearches.delete(id);
        resolve([]);
      }
    });
  }

  /**
   * Streams cipher documents to the Worker in small chunks then signals `buildIndex`.
   *
   * WHY STREAMING: The old approach built a full `LunrDocumentData[]` array (80 K items)
   * on the main thread, then `postMessage`'d it — which structured-clones the entire array
   * into a transfer buffer, briefly holding three copies of the data (source array, clone
   * buffer, Worker heap copy). That caused OOM errors for large vaults.
   *
   * With chunked streaming each chunk is serialised and sent immediately, so the main thread
   * holds at most ~CHUNK_SIZE documents at once before the GC can reclaim the previous chunk.
   *
   * Returns `true` if the Worker was used, `false` if it was unavailable.
   */
  private async buildIndexInWorker(userId: UserId, ciphers: CipherViewLike[]): Promise<boolean> {
    const worker = this.getOrCreateWorker(userId as string);
    if (!worker) {
      return false;
    }

    const t0 = performance.now();
    const CHUNK_SIZE = 2_000;

    // Register the completion listener BEFORE streaming so no message is missed.
    const completionPromise = new Promise<boolean>((resolve) => {
      const onMessage = (
        event: MessageEvent<{ type: "buildComplete" } | { type: "error"; error: string }>,
      ) => {
        const msg = event.data;
        if (msg.type !== "buildComplete" && msg.type !== "error") {
          return; // search results — not ours
        }
        worker.removeEventListener("message", onMessage);

        if (msg.type === "error") {
          this.logService.error(new Error(`[SearchService] Worker build error: ${msg.error}`));
          this.terminateWorker(userId as string);
          resolve(false);
          return;
        }

        this.logService.measure(t0, "Vault", "SearchService", "Worker build complete");
        this.workerIndexReady.add(userId as string);
        resolve(true);
      };

      worker.addEventListener("message", onMessage);
      worker.onerror = (err) => {
        worker.removeEventListener("message", onMessage);
        this.logService.error(
          new Error(`[SearchService] Worker onerror during build: ${String(err)}`),
        );
        this.terminateWorker(userId as string);
        resolve(false);
      };
    });

    // Stream chunks: serialise and post each chunk, then yield to the browser.
    // Each chunk reference is dropped after postMessage so the GC can reclaim it
    // before the next chunk is allocated.
    for (let i = 0; i < ciphers.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, ciphers.length);
      const chunk: LunrDocumentData[] = [];
      for (let j = i; j < end; j++) {
        chunk.push(this.prepareLunrDocument(ciphers[j]));
      }
      worker.postMessage({ type: "addDocuments", documents: chunk });
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    // All chunks sent — tell the Worker to build.
    worker.postMessage({ type: "buildIndex" });

    return completionPromise;
  }

  /**
   * Sends a search query to the Worker and awaits the result refs. Returns `null` if the
   * Worker is not available or has no index yet (caller should fall back to main-thread).
   */
  private searchInWorker(
    userId: string,
    query: string,
    isQueryString: boolean,
    terms: string[],
  ): Promise<Array<{ ref: string; score: number }> | null> {
    if (!this.workerIndexReady.has(userId)) {
      return Promise.resolve(null);
    }
    const worker = this.searchWorkers.get(userId);
    if (!worker) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const requestId = `${userId}:${Math.random().toString(36).slice(2)}`;
      this.pendingSearches.set(requestId, resolve);
      worker.postMessage({ type: "search", requestId, query, isQueryString, terms });
    });
  }

  /**
   * Fallback: builds the Lunr index on the main thread while yielding between chunks of
   * {@link CHUNK_SIZE} documents. `builder.build()` is still a single synchronous call
   * that will block briefly on very large vaults — use the Worker path where possible.
   */
  private async buildIndexChunked(
    builder: lunr.Builder,
    ciphers: CipherViewLike[],
  ): Promise<SerializedLunrIndex> {
    const CHUNK_SIZE = 1_000;
    const t0 = performance.now();
    for (let i = 0; i < ciphers.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, ciphers.length);
      for (let j = i; j < end; j++) {
        builder.add(ciphers[j]);
      }
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    const serialized = builder.build().toJSON() as SerializedLunrIndex;
    this.logService.measure(t0, "Vault", "SearchService", "chunked index build");
    return serialized;
  }

  /**
   * Converts a {@link CipherViewLike} into a plain, structured object whose shape matches
   * the Lunr field definitions used in the worker. All field extraction logic lives here
   * (on the main thread) so the worker file stays free of Bitwarden-specific imports.
   */
  private prepareLunrDocument(c: CipherViewLike): LunrDocumentData {
    const subtitle = CipherViewLikeUtils.subtitle(c);
    return {
      id: uuidAsString(c.id),
      shortid: uuidAsString(c.id).substring(0, 8),
      name: c.name ?? null,
      subtitle:
        subtitle != null && CipherViewLikeUtils.getType(c) === CipherType.Card
          ? subtitle.replace(/\*/g, "")
          : (subtitle ?? null),
      notes: CipherViewLikeUtils.getNotes(c) ?? null,
      login: this.extractLoginFields(c),
      fields: this.fieldExtractor(c, false) as string[] | null,
      fields_joined: this.fieldExtractor(c, true) as string | null,
      attachments: this.attachmentExtractor(c, false) as string[] | null,
      attachments_joined: this.attachmentExtractor(c, true) as string | null,
      organizationid: (c.organizationId as string) ?? null,
    };
  }

  private extractLoginFields(
    c: CipherViewLike,
  ): { username: string | null; uris: string[] | null } | null {
    const login = CipherViewLikeUtils.getLogin(c);
    // uriExtractor already returns null for non-Login cipher types.
    const uris = this.uriExtractor(c) as string[] | null;
    if (!login && !uris) {
      return null;
    }
    return { username: login?.username ?? null, uris };
  }

  private fieldExtractor(c: CipherViewLike, joined: boolean) {
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

  private attachmentExtractor(c: CipherViewLike, joined: boolean) {
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

  private uriExtractor(c: CipherViewLike) {
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
